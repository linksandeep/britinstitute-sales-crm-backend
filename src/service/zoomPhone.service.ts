import type { ILead } from '../types';

const ZOOM_API_BASE_URL = 'https://api.zoom.us/v2';
const ZOOM_OAUTH_URL = 'https://zoom.us/oauth/token';
const MAX_ZOOM_PAGE_SIZE = 300;
const DEFAULT_LOOKBACK_DAYS = 30;

interface ZoomTokenCache {
  accessToken: string;
  expiresAt: number;
}

export interface ZoomPhoneQuery {
  from?: string;
  to?: string;
  type?: string;
  nextPageToken?: string;
  pageSize?: number;
}

export interface ZoomPhoneOwner {
  id?: string;
  name?: string;
  extension_number?: string;
  phone_number?: string;
  type?: string;
}

export interface ZoomPhoneCallLog {
  id?: string;
  call_id?: string;
  call_type?: string;
  direction?: string;
  duration?: number;
  date_time?: string;
  answer_start_time?: string;
  call_end_time?: string;
  caller_number?: string;
  callee_number?: string;
  caller_did_number?: string;
  callee_did_number?: string;
  caller_phone_number?: string;
  callee_phone_number?: string;
  caller_name?: string;
  callee_name?: string;
  result?: string;
  path?: string;
  recording_id?: string;
  recording_type?: string;
  owner?: ZoomPhoneOwner;
  user_id?: string;
  site?: {
    id?: string;
    name?: string;
  };
}

export interface ZoomPhoneRecording {
  id?: string;
  call_id?: string;
  call_log_id?: string;
  call_element_id?: string;
  caller_number?: string;
  callee_number?: string;
  caller_name?: string;
  callee_name?: string;
  direction?: string;
  duration?: number;
  date_time?: string;
  end_time?: string;
  download_url?: string;
  file_url?: string;
  transcript_download_url?: string;
  recording_type?: string;
  owner?: ZoomPhoneOwner;
}

interface ZoomCallLogsResponse {
  call_logs?: ZoomPhoneCallLog[];
  from?: string;
  to?: string;
  next_page_token?: string;
  page_count?: number;
  page_size?: number;
  total_records?: number;
}

interface ZoomRecordingsResponse {
  recordings?: ZoomPhoneRecording[];
  next_page_token?: string;
  page_count?: number;
  page_size?: number;
  total_records?: number;
}

interface ZoomTokenResponse {
  access_token?: string;
  expires_in?: number;
}

let tokenCache: ZoomTokenCache | null = null;

const getMissingConfig = () =>
  ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'].filter((key) => !process.env[key]);

const ensureConfigured = () => {
  const missing = getMissingConfig();
  if (missing.length > 0) {
    const error = new Error(`Zoom Phone is not configured. Missing: ${missing.join(', ')}`);
    (error as Error & { statusCode?: number }).statusCode = 503;
    throw error;
  }
};

const getNumberValue = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
};

const toDateParam = (date: Date) => date.toISOString().slice(0, 10);

const isDateParam = (value: string | undefined) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

const buildDateRange = (query: ZoomPhoneQuery) => {
  const today = new Date();
  const defaultDays = getNumberValue(
    process.env.ZOOM_PHONE_DEFAULT_FROM_DAYS,
    DEFAULT_LOOKBACK_DAYS,
    1,
    31
  );
  const defaultFrom = new Date(today);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - defaultDays);

  const from = query.from && isDateParam(query.from) ? query.from : toDateParam(defaultFrom);
  const to = query.to && isDateParam(query.to) ? query.to : toDateParam(today);

  return { from, to };
};

const buildPageSize = (pageSize?: number) => {
  const configuredMax = getNumberValue(
    process.env.ZOOM_PHONE_MAX_PAGE_SIZE,
    MAX_ZOOM_PAGE_SIZE,
    1,
    MAX_ZOOM_PAGE_SIZE
  );
  const requested = pageSize && Number.isFinite(pageSize) ? Math.trunc(pageSize) : configuredMax;
  return Math.min(Math.max(requested, 1), configuredMax, MAX_ZOOM_PAGE_SIZE);
};

export const normalizePhoneNumber = (value?: string) => (value || '').replace(/\D/g, '');

const comparableNumbers = (value?: string) => {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return [];
  const variants = new Set([normalized]);
  if (normalized.length >= 10) {
    variants.add(normalized.slice(-10));
  }
  return Array.from(variants);
};

export const getLeadZoomNumbers = (lead: ILead) => {
  const numbers = [lead.phone, lead.whatsapp, lead.zoomPhoneNumber]
    .flatMap(comparableNumbers)
    .filter(Boolean);

  return Array.from(new Set(numbers));
};

const getCandidatePhoneValues = (item: ZoomPhoneCallLog | ZoomPhoneRecording) => {
  const record = item as Record<string, unknown>;
  const keys = [
    'caller_number',
    'callee_number',
    'caller_did_number',
    'callee_did_number',
    'caller_phone_number',
    'callee_phone_number'
  ];

  const directValues = keys
    .map((key) => record[key])
    .filter((value): value is string => typeof value === 'string');

  const owner = record.owner;
  if (owner && typeof owner === 'object') {
    const ownerRecord = owner as Record<string, unknown>;
    ['phone_number', 'extension_number'].forEach((key) => {
      const value = ownerRecord[key];
      if (typeof value === 'string') directValues.push(value);
    });
  }

  return directValues;
};

const phoneMatchesLead = (item: ZoomPhoneCallLog | ZoomPhoneRecording, leadNumbers: string[]) => {
  if (leadNumbers.length === 0) return false;

  const itemNumbers = getCandidatePhoneValues(item).flatMap(comparableNumbers);
  return itemNumbers.some((itemNumber) =>
    leadNumbers.some((leadNumber) => itemNumber === leadNumber || itemNumber.endsWith(leadNumber) || leadNumber.endsWith(itemNumber))
  );
};

const buildZoomQuery = (query: ZoomPhoneQuery) => {
  const dateRange = buildDateRange(query);
  const zoomQuery: Record<string, string> = {
    from: dateRange.from,
    to: dateRange.to,
    page_size: String(buildPageSize(query.pageSize))
  };

  if (query.type) zoomQuery.type = query.type;
  if (query.nextPageToken) zoomQuery.next_page_token = query.nextPageToken;

  return zoomQuery;
};

const getZoomAccessToken = async () => {
  ensureConfigured();

  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID as string;
  const clientId = process.env.ZOOM_CLIENT_ID as string;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET as string;

  const url = new URL(ZOOM_OAUTH_URL);
  url.searchParams.set('grant_type', 'account_credentials');
  url.searchParams.set('account_id', accountId);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
    }
  });

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`Zoom authentication failed (${response.status}): ${details.slice(0, 300)}`);
    (error as Error & { statusCode?: number }).statusCode = response.status;
    throw error;
  }

  const data = (await response.json()) as ZoomTokenResponse;
  if (!data.access_token) {
    const error = new Error('Zoom authentication did not return an access token');
    (error as Error & { statusCode?: number }).statusCode = 502;
    throw error;
  }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000
  };

  return data.access_token;
};

const requestZoomJson = async <T>(endpoint: string, query?: Record<string, string>, retry = true): Promise<T> => {
  const token = await getZoomAccessToken();
  const url = new URL(`${ZOOM_API_BASE_URL}${endpoint}`);

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (response.status === 401 && retry) {
    tokenCache = null;
    return requestZoomJson<T>(endpoint, query, false);
  }

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`Zoom Phone API request failed (${response.status}): ${details.slice(0, 300)}`);
    (error as Error & { statusCode?: number }).statusCode = response.status;
    throw error;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
};

const requestZoomFile = async (urlOrEndpoint: string, retry = true): Promise<Response> => {
  const token = await getZoomAccessToken();
  const isAbsolute = /^https?:\/\//i.test(urlOrEndpoint);
  const url = isAbsolute ? urlOrEndpoint : `${ZOOM_API_BASE_URL}${urlOrEndpoint}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (response.status === 401 && retry) {
    tokenCache = null;
    return requestZoomFile(urlOrEndpoint, false);
  }

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`Zoom recording download failed (${response.status}): ${details.slice(0, 300)}`);
    (error as Error & { statusCode?: number }).statusCode = response.status;
    throw error;
  }

  return response;
};

const assertZoomDownloadUrl = (downloadUrl?: string) => {
  if (!downloadUrl) return null;

  try {
    const parsed = new URL(downloadUrl);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== 'https:' || (host !== 'zoom.us' && !host.endsWith('.zoom.us'))) {
      throw new Error('Invalid Zoom recording URL');
    }
    return parsed.toString();
  } catch {
    const error = new Error('Invalid Zoom recording download URL');
    (error as Error & { statusCode?: number }).statusCode = 400;
    throw error;
  }
};

export const zoomPhoneService = {
  getStatus: () => {
    const missing = getMissingConfig();
    return {
      configured: missing.length === 0,
      missing,
      provider: 'Zoom Phone',
      mode: 'server-to-server-oauth'
    };
  },

  getAccountCallLogs: async (query: ZoomPhoneQuery) => {
    return requestZoomJson<ZoomCallLogsResponse>('/phone/call_logs', buildZoomQuery(query));
  },

  getLeadCallHistory: async (lead: ILead, query: ZoomPhoneQuery) => {
    const response = await requestZoomJson<ZoomCallLogsResponse>('/phone/call_logs', buildZoomQuery(query));
    const leadNumbers = getLeadZoomNumbers(lead);
    const callLogs = (response.call_logs || []).filter((call) => phoneMatchesLead(call, leadNumbers));

    return {
      ...response,
      call_logs: callLogs,
      total_records: callLogs.length,
      matched_numbers: leadNumbers
    };
  },

  getLeadRecordings: async (lead: ILead, query: ZoomPhoneQuery) => {
    const response = await requestZoomJson<ZoomRecordingsResponse>('/phone/recordings', buildZoomQuery(query));
    const leadNumbers = getLeadZoomNumbers(lead);
    const recordings = (response.recordings || []).filter((recording) => phoneMatchesLead(recording, leadNumbers));

    return {
      ...response,
      recordings,
      total_records: recordings.length,
      matched_numbers: leadNumbers
    };
  },

  getCallLogRecordings: async (lead: ILead, callLogId: string) => {
    const response = await requestZoomJson<ZoomRecordingsResponse>(
      `/phone/call_logs/${encodeURIComponent(callLogId)}/recordings`
    );
    const leadNumbers = getLeadZoomNumbers(lead);
    const recordings = (response.recordings || []).filter((recording) => phoneMatchesLead(recording, leadNumbers));

    return {
      ...response,
      recordings,
      total_records: recordings.length,
      matched_numbers: leadNumbers
    };
  },

  downloadRecording: async (recordingId: string, downloadUrl?: string) => {
    const safeDownloadUrl = assertZoomDownloadUrl(downloadUrl);
    if (safeDownloadUrl) {
      return requestZoomFile(safeDownloadUrl);
    }

    return requestZoomFile(`/phone/recording/download/${encodeURIComponent(recordingId)}`);
  }
};
