const ZOOM_API_BASE_URL = 'https://api.zoom.us/v2';
const ZOOM_OAUTH_URL = 'https://zoom.us/oauth/token';

interface ZoomTokenCache {
  accessToken: string;
  expiresAt: number;
}

interface ZoomTokenResponse {
  access_token?: string;
  expires_in?: number;
}

export interface CreateZoomMeetingInput {
  topic: string;
  agenda?: string;
  startTime: string;
  duration: number;
  timezone?: string;
  hostZoomUserId?: string;
  joinBeforeHost?: boolean;
  waitingRoom?: boolean;
  autoRecording?: 'none' | 'local' | 'cloud';
}

export interface ZoomMeetingResponse {
  id: number | string;
  uuid?: string;
  topic?: string;
  agenda?: string;
  start_time?: string;
  duration?: number;
  timezone?: string;
  join_url?: string;
  start_url?: string;
  password?: string;
  status?: string;
  settings?: Record<string, unknown>;
}

let tokenCache: ZoomTokenCache | null = null;

const getMissingConfig = () =>
  ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'].filter((key) => !process.env[key]);

const ensureConfigured = () => {
  const missing = getMissingConfig();
  if (missing.length > 0) {
    const error = new Error(`Zoom API is not configured. Missing: ${missing.join(', ')}`);
    (error as Error & { statusCode?: number }).statusCode = 503;
    throw error;
  }
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

const requestZoomJson = async <T>(
  endpoint: string,
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: Record<string, unknown> } = {},
  retry = true
): Promise<T> => {
  const token = await getZoomAccessToken();
  const requestInit: RequestInit = {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  };

  if (options.body) {
    requestInit.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${ZOOM_API_BASE_URL}${endpoint}`, requestInit);

  if (response.status === 401 && retry) {
    tokenCache = null;
    return requestZoomJson<T>(endpoint, options, false);
  }

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`Zoom Meeting API request failed (${response.status}): ${details.slice(0, 300)}`);
    (error as Error & { statusCode?: number }).statusCode = response.status;
    throw error;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
};

export const zoomMeetingsService = {
  getStatus: () => {
    const missing = getMissingConfig();
    return {
      configured: missing.length === 0,
      missing,
      provider: 'Zoom Meetings',
      mode: 'server-to-server-oauth',
      defaultHostUserId: process.env.ZOOM_MEETING_HOST_USER_ID || 'me',
      timezone: process.env.ZOOM_MEETING_DEFAULT_TIMEZONE || 'Europe/London'
    };
  },

  createMeeting: async (input: CreateZoomMeetingInput) => {
    const hostUserId = encodeURIComponent(
      input.hostZoomUserId || process.env.ZOOM_MEETING_HOST_USER_ID || 'me'
    );
    const timezone = input.timezone || process.env.ZOOM_MEETING_DEFAULT_TIMEZONE || 'Europe/London';
    const body: Record<string, unknown> = {
      topic: input.topic,
      type: 2,
      start_time: input.startTime,
      duration: input.duration,
      timezone,
      default_password: true,
      settings: {
        join_before_host: Boolean(input.joinBeforeHost),
        waiting_room: input.waitingRoom !== false,
        mute_upon_entry: true,
        participant_video: false,
        host_video: false,
        auto_recording: input.autoRecording || 'none'
      }
    };

    if (input.agenda) body.agenda = input.agenda;

    return requestZoomJson<ZoomMeetingResponse>(`/users/${hostUserId}/meetings`, {
      method: 'POST',
      body
    });
  },

  getMeeting: async (meetingId: string) => {
    return requestZoomJson<ZoomMeetingResponse>(`/meetings/${encodeURIComponent(meetingId)}`);
  },

  deleteMeeting: async (meetingId: string) => {
    return requestZoomJson<Record<string, never>>(`/meetings/${encodeURIComponent(meetingId)}`, {
      method: 'DELETE'
    });
  }
};
