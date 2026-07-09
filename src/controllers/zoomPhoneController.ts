import { Request, Response } from 'express';
import { Readable } from 'stream';
import Lead from '../models/Lead';
import { zoomPhoneService, type ZoomPhoneQuery } from '../service/zoomPhone.service';
import type { ILead } from '../types';

const getStatusCode = (error: unknown) => {
  const statusCode = (error as { statusCode?: number })?.statusCode;
  return statusCode && statusCode >= 400 && statusCode < 600 ? statusCode : 500;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown Zoom Phone error';

const getLeadForRequest = async (req: Request, res: Response): Promise<ILead | null> => {
  const { leadId } = req.params;
  const lead = await Lead.findById(leadId);

  if (!lead) {
    res.status(404).json({
      success: false,
      message: 'Lead not found'
    });
    return null;
  }

  if (req.user?.role !== 'admin' && String(lead.assignedTo || '') !== String(req.user?.userId || '')) {
    res.status(403).json({
      success: false,
      message: 'Access denied'
    });
    return null;
  }

  return lead;
};

const getStringQuery = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

const getAudioDisposition = (req: Request, recordingId: string) => {
  const mode = getStringQuery(req.query.disposition);
  const disposition = mode === 'attachment' ? 'attachment' : 'inline';
  const filename = `zoom-phone-recording-${recordingId.replace(/[^a-zA-Z0-9._-]/g, '-')}.mp3`;
  return `${disposition}; filename="${filename}"`;
};

const pipeZoomRecordingResponse = (req: Request, res: Response, zoomResponse: globalThis.Response) => {
  const headersToForward = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'etag',
    'last-modified'
  ];

  for (const header of headersToForward) {
    const value = zoomResponse.headers.get(header);
    if (value) {
      res.setHeader(header, value);
    }
  }

  if (!zoomResponse.headers.get('accept-ranges')) {
    res.setHeader('Accept-Ranges', 'bytes');
  }

  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Content-Disposition', getAudioDisposition(req, req.params.recordingId));
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range, Content-Type');
  res.removeHeader('Content-Security-Policy');
  res.status(zoomResponse.status);

  if (!zoomResponse.body) {
    res.status(502).json({
      success: false,
      message: 'Zoom recording response did not include audio content'
    });
    return;
  }

  const stream = Readable.fromWeb(zoomResponse.body as unknown as Parameters<typeof Readable.fromWeb>[0]);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        message: 'Failed to stream Zoom recording'
      });
      return;
    }
    res.end();
  });
  stream.pipe(res);
};

const getNumberQuery = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getZoomQuery = (req: Request): ZoomPhoneQuery => {
  const query: ZoomPhoneQuery = {};
  const from = getStringQuery(req.query.from);
  const to = getStringQuery(req.query.to);
  const type = getStringQuery(req.query.type);
  const nextPageToken = getStringQuery(req.query.nextPageToken);
  const pageSize = getNumberQuery(req.query.pageSize);
  const maxPages = getNumberQuery(req.query.maxPages);

  if (from) query.from = from;
  if (to) query.to = to;
  if (type) query.type = type;
  if (nextPageToken) query.nextPageToken = nextPageToken;
  if (pageSize) query.pageSize = pageSize;
  if (maxPages) query.maxPages = maxPages;

  return query;
};

const getRecordingIdentity = (recording: {
  id?: string;
  call_id?: string;
  call_log_id?: string;
  call_history_id?: string;
  call_element_id?: string;
}) => recording.id || recording.call_id || recording.call_log_id || recording.call_history_id || recording.call_element_id || '';

const findLeadRecording = async (lead: ILead, req: Request) => {
  const requestedRecordingId = req.params.recordingId;
  const requestedDownloadUrl = getStringQuery(req.query.downloadUrl);
  const requestedCallLogId = getStringQuery(req.query.callLogId);

  const response = requestedCallLogId
    ? await zoomPhoneService.getCallLogRecordings(lead, requestedCallLogId)
    : await zoomPhoneService.getLeadRecordings(lead, getZoomQuery(req));

  return (response.recordings || []).find((recording) => {
    const id = getRecordingIdentity(recording);
    return (
      id === requestedRecordingId ||
      recording.download_url === requestedDownloadUrl ||
      recording.file_url === requestedDownloadUrl
    );
  });
};

export const getZoomPhoneStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      message: 'Zoom Phone configuration status',
      data: zoomPhoneService.getStatus()
    });
  } catch (error) {
    res.status(getStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
};

export const getAccountZoomCallLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await zoomPhoneService.getAccountCallLogs(getZoomQuery(req));
    res.status(200).json({
      success: true,
      message: 'Zoom Phone account call logs retrieved successfully',
      data
    });
  } catch (error) {
    res.status(getStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
};

export const getAccountZoomRecordings = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await zoomPhoneService.getAccountRecordings(getZoomQuery(req));
    res.status(200).json({
      success: true,
      message: 'Zoom Phone account recordings retrieved successfully',
      data
    });
  } catch (error) {
    res.status(getStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
};

export const getAccountZoomInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await zoomPhoneService.getAccountInventory(getZoomQuery(req));
    res.status(200).json({
      success: true,
      message: 'Zoom Phone inventory retrieved successfully',
      data
    });
  } catch (error) {
    res.status(getStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
};

export const getAccountZoomLiveStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await zoomPhoneService.getAccountLiveStatus(getZoomQuery(req));
    res.status(200).json({
      success: true,
      message: 'Zoom Phone live status retrieved successfully',
      data
    });
  } catch (error) {
    res.status(getStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
};

export const getAccountZoomAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await zoomPhoneService.getAccountAnalytics(getZoomQuery(req));
    res.status(200).json({
      success: true,
      message: 'Zoom Phone analytics retrieved successfully',
      data
    });
  } catch (error) {
    res.status(getStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
};

export const getLeadZoomCalls = async (req: Request, res: Response): Promise<void> => {
  try {
    const lead = await getLeadForRequest(req, res);
    if (!lead) return;

    const data = await zoomPhoneService.getLeadCallHistory(lead, getZoomQuery(req));
    res.status(200).json({
      success: true,
      message: 'Lead Zoom Phone call history retrieved successfully',
      data
    });
  } catch (error) {
    res.status(getStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
};

export const getLeadZoomRecordings = async (req: Request, res: Response): Promise<void> => {
  try {
    const lead = await getLeadForRequest(req, res);
    if (!lead) return;

    const data = await zoomPhoneService.getLeadRecordings(lead, getZoomQuery(req));
    res.status(200).json({
      success: true,
      message: 'Lead Zoom Phone recordings retrieved successfully',
      data
    });
  } catch (error) {
    res.status(getStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
};

export const getLeadCallLogRecordings = async (req: Request, res: Response): Promise<void> => {
  try {
    const lead = await getLeadForRequest(req, res);
    if (!lead) return;

    const data = await zoomPhoneService.getCallLogRecordings(lead, req.params.callLogId);
    res.status(200).json({
      success: true,
      message: 'Zoom Phone call recordings retrieved successfully',
      data
    });
  } catch (error) {
    res.status(getStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
};

export const streamLeadZoomRecording = async (req: Request, res: Response): Promise<void> => {
  try {
    const lead = await getLeadForRequest(req, res);
    if (!lead) return;

    const recording = await findLeadRecording(lead, req);
    if (!recording) {
      res.status(404).json({
        success: false,
        message: 'Recording was not found for this lead'
      });
      return;
    }

    const zoomResponse = await zoomPhoneService.downloadRecording(
      req.params.recordingId,
      recording.download_url || recording.file_url || getStringQuery(req.query.downloadUrl),
      req.headers.range
    );

    pipeZoomRecordingResponse(req, res, zoomResponse);
  } catch (error) {
    res.status(getStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
};

export const streamAccountZoomRecording = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // The token is now handled by the middleware, so remove the manual check
    // Just proceed with the streaming

    const zoomResponse = await zoomPhoneService.downloadRecording(
      req.params.recordingId,
      getStringQuery(req.query.downloadUrl),
      req.headers.range
    );

    pipeZoomRecordingResponse(req, res, zoomResponse);
  } catch (error) {
    res.status(getStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
};
