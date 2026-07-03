import { Request, Response } from 'express';
import { Types } from 'mongoose';
import Lead from '../models/Lead';
import ZoomMeeting from '../models/ZoomMeeting';
import { zoomMeetingsService } from '../service/zoomMeetings.service';

const getStatusCode = (error: unknown) => {
  const statusCode = (error as { statusCode?: number })?.statusCode;
  return statusCode && statusCode >= 400 && statusCode < 600 ? statusCode : 500;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown Zoom Meetings error';

const isValidObjectId = (value?: string) => Boolean(value && Types.ObjectId.isValid(value));

const canAccessLead = async (leadId: string, req: Request) => {
  if (!isValidObjectId(leadId)) return false;
  const lead = await Lead.findById(leadId).select('assignedTo');
  if (!lead) return false;
  return req.user?.role === 'admin' || String(lead.assignedTo || '') === String(req.user?.userId || '');
};

const getMeetingForRequest = async (req: Request, res: Response) => {
  const meeting = await ZoomMeeting.findById(req.params.id)
    .populate('lead', 'name email phone status')
    .populate('createdBy', 'name email phone')
    .populate('hostUser', 'name email phone');

  if (!meeting) {
    res.status(404).json({
      success: false,
      message: 'Zoom meeting not found'
    });
    return null;
  }

  const isOwner = String(meeting.createdBy?._id || meeting.createdBy) === String(req.user?.userId || '');
  const isHost = String(meeting.hostUser?._id || meeting.hostUser || '') === String(req.user?.userId || '');

  if (req.user?.role !== 'admin' && !isOwner && !isHost) {
    res.status(403).json({
      success: false,
      message: 'Access denied'
    });
    return null;
  }

  return meeting;
};

export const getZoomMeetingsStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      message: 'Zoom Meetings configuration status',
      data: zoomMeetingsService.getStatus()
    });
  } catch (error) {
    res.status(getStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
};

export const listZoomMeetings = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const filter: Record<string, unknown> =
      req.user?.role === 'admin'
        ? {}
        : {
            $or: [
              { createdBy: new Types.ObjectId(String(req.user?.userId)) },
              { hostUser: new Types.ObjectId(String(req.user?.userId)) }
            ]
          };

    if (status && status !== 'all') filter.status = status;
    if (search) {
      filter.$text = { $search: search };
    }

    const meetings = await ZoomMeeting.find(filter)
      .populate('lead', 'name email phone status')
      .populate('createdBy', 'name email phone')
      .populate('hostUser', 'name email phone')
      .sort({ startTime: -1 })
      .limit(250);

    res.status(200).json({
      success: true,
      message: 'Zoom meetings retrieved successfully',
      data: meetings
    });
  } catch (error) {
    res.status(getStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
};

export const createZoomMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      topic,
      agenda,
      startTime,
      duration,
      timezone,
      leadId,
      hostUserId,
      hostZoomUserId,
      joinBeforeHost,
      waitingRoom,
      autoRecording
    } = req.body;

    if (!topic || typeof topic !== 'string' || topic.trim().length < 2) {
      res.status(400).json({
        success: false,
        message: 'Meeting topic is required'
      });
      return;
    }

    const parsedStartTime = new Date(startTime);
    if (!startTime || Number.isNaN(parsedStartTime.getTime())) {
      res.status(400).json({
        success: false,
        message: 'Valid meeting start time is required'
      });
      return;
    }

    const parsedDuration = Number(duration || 30);
    if (!Number.isFinite(parsedDuration) || parsedDuration < 1 || parsedDuration > 1440) {
      res.status(400).json({
        success: false,
        message: 'Duration must be between 1 and 1440 minutes'
      });
      return;
    }

    if (leadId && !(await canAccessLead(leadId, req))) {
      res.status(403).json({
        success: false,
        message: 'You do not have access to the selected lead'
      });
      return;
    }

    if (hostUserId && !isValidObjectId(hostUserId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid CRM host user'
      });
      return;
    }

    const zoomPayload = {
      topic: topic.trim(),
      startTime,
      duration: Math.trunc(parsedDuration),
      joinBeforeHost: Boolean(joinBeforeHost),
      waitingRoom: waitingRoom !== false,
      autoRecording: ['local', 'cloud', 'none'].includes(autoRecording) ? autoRecording : 'none'
    };

    if (typeof agenda === 'string' && agenda.trim()) {
      Object.assign(zoomPayload, { agenda: agenda.trim() });
    }
    if (typeof timezone === 'string' && timezone.trim()) {
      Object.assign(zoomPayload, { timezone: timezone.trim() });
    }
    if (typeof hostZoomUserId === 'string' && hostZoomUserId.trim()) {
      Object.assign(zoomPayload, { hostZoomUserId: hostZoomUserId.trim() });
    }

    const zoomMeeting = await zoomMeetingsService.createMeeting(zoomPayload);

    const meeting = await ZoomMeeting.create({
      topic: zoomMeeting.topic || topic.trim(),
      agenda: zoomMeeting.agenda || (typeof agenda === 'string' ? agenda.trim() : ''),
      startTime: zoomMeeting.start_time ? new Date(zoomMeeting.start_time) : parsedStartTime,
      duration: zoomMeeting.duration || Math.trunc(parsedDuration),
      timezone: zoomMeeting.timezone || timezone || process.env.ZOOM_MEETING_DEFAULT_TIMEZONE || 'Europe/London',
      lead: leadId && isValidObjectId(leadId) ? new Types.ObjectId(leadId) : undefined,
      createdBy: new Types.ObjectId(String(req.user?.userId)),
      hostUser: hostUserId && isValidObjectId(hostUserId) ? new Types.ObjectId(hostUserId) : undefined,
      zoomMeetingId: String(zoomMeeting.id),
      zoomUuid: zoomMeeting.uuid,
      joinUrl: zoomMeeting.join_url,
      startUrl: zoomMeeting.start_url,
      password: zoomMeeting.password,
      status: 'scheduled',
      rawZoomResponse: zoomMeeting as unknown as Record<string, unknown>,
      lastSyncedAt: new Date()
    });

    await meeting.populate('lead', 'name email phone status');
    await meeting.populate('createdBy', 'name email phone');
    await meeting.populate('hostUser', 'name email phone');

    res.status(201).json({
      success: true,
      message: 'Zoom meeting created successfully',
      data: meeting
    });
  } catch (error) {
    res.status(getStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
};

export const getZoomMeetingById = async (req: Request, res: Response): Promise<void> => {
  try {
    const meeting = await getMeetingForRequest(req, res);
    if (!meeting) return;

    try {
      const latest = await zoomMeetingsService.getMeeting(meeting.zoomMeetingId);
      meeting.rawZoomResponse = latest as unknown as Record<string, unknown>;
      meeting.lastSyncedAt = new Date();
      meeting.status = latest.status === 'waiting' || latest.status === 'started' ? 'synced' : meeting.status;
      await meeting.save({ validateModifiedOnly: true });
    } catch (syncError) {
      console.warn('Zoom meeting detail sync failed:', getErrorMessage(syncError));
    }

    res.status(200).json({
      success: true,
      message: 'Zoom meeting retrieved successfully',
      data: meeting
    });
  } catch (error) {
    res.status(getStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
};

export const cancelZoomMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const meeting = await getMeetingForRequest(req, res);
    if (!meeting) return;

    const isOwner = String(meeting.createdBy?._id || meeting.createdBy) === String(req.user?.userId || '');
    if (req.user?.role !== 'admin' && !isOwner) {
      res.status(403).json({
        success: false,
        message: 'Only the creator or an admin can cancel this meeting'
      });
      return;
    }

    await zoomMeetingsService.deleteMeeting(meeting.zoomMeetingId);
    meeting.status = 'cancelled';
    meeting.lastSyncedAt = new Date();
    await meeting.save({ validateModifiedOnly: true });

    res.status(200).json({
      success: true,
      message: 'Zoom meeting cancelled successfully',
      data: meeting
    });
  } catch (error) {
    res.status(getStatusCode(error)).json({
      success: false,
      message: getErrorMessage(error)
    });
  }
};
