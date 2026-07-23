import Lead from '../models/Lead';
import User from '../models/User';
import type { ILead } from '../types';

const ZOOM_API_BASE_URL = 'https://api.zoom.us/v2';
const ZOOM_OAUTH_URL = 'https://zoom.us/oauth/token';
const MAX_ZOOM_PAGE_SIZE = 300;
const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_ANALYTICS_MAX_PAGES = 5;

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
  maxPages?: number;
  includeRecordings?: boolean;
}

export interface ZoomPhoneOwner {
  id?: string;
  name?: string;
  extension_number?: string;
  phone_number?: string;
  type?: string;
}

export interface ZoomPhoneCrmUserMatch {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
}

export interface ZoomPhoneCrmLeadMatch {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface ZoomPhoneCallLog {
  id?: string;
  call_id?: string;
  source?: 'call_log' | 'metrics' | 'recording';
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
  matched_user?: ZoomPhoneCrmUserMatch;
  matched_lead?: ZoomPhoneCrmLeadMatch;
}

export interface ZoomPhoneRecording {
  id?: string;
  call_id?: string;
  call_log_id?: string;
  call_history_id?: string;
  call_element_id?: string;
  caller_number?: string;
  caller_number_type?: string;
  callee_number?: string;
  callee_number_type?: string;
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
  site?: {
    id?: string;
    name?: string;
  };
  disclaimer_status?: string;
  matched_user?: ZoomPhoneCrmUserMatch;
  matched_lead?: ZoomPhoneCrmLeadMatch;
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

export interface ZoomPhoneNumber {
  id?: string;
  number?: string;
  display_number?: string;
  source?: string;
  status?: string;
  capability?: string[];
  assignee?: {
    id?: string;
    name?: string;
    extension_number?: string;
    extension_type?: string;
    type?: string;
  };
  location?: string;
  emergency_address?: {
    address_line1?: string;
    city?: string;
    state_code?: string;
    country?: string;
    zip?: string;
  };
  site?: {
    id?: string;
    name?: string;
  };
}

export interface ZoomPhoneUser {
  id?: string;
  phone_user_id?: string;
  email?: string;
  name?: string;
  extension_id?: string;
  extension_number?: string;
  status?: string;
  activation_status?: string;
  calling_plans?: Array<{
    type?: string;
    name?: string;
    billing_account_id?: string;
  }>;
  phone_numbers?: ZoomPhoneNumber[];
}

interface ZoomPhoneNumbersResponse {
  phone_numbers?: ZoomPhoneNumber[];
  next_page_token?: string;
  page_size?: number;
  total_records?: number;
}

interface ZoomPhoneUsersResponse {
  users?: ZoomPhoneUser[];
  next_page_token?: string;
  page_size?: number;
  total_records?: number;
}

export interface ZoomPhoneInventoryResponse {
  phone_numbers: ZoomPhoneNumber[];
  users: ZoomPhoneUser[];
  summary: {
    total_numbers: number;
    assigned_numbers: number;
    unassigned_numbers: number;
    available_numbers: number;
    busy_numbers: number;
    inactive_numbers: number;
    total_users: number;
    active_users: number;
    inactive_users: number;
  };
  number_status_breakdown: ZoomPhoneAnalyticsBreakdown[];
  user_status_breakdown: ZoomPhoneAnalyticsBreakdown[];
  capability_breakdown: ZoomPhoneAnalyticsBreakdown[];
  pages_scanned: {
    numbers: number;
    users: number;
  };
}

export interface ZoomPhoneMetricParty {
  phone_number?: string;
  extension_number?: string;
  device_type?: string;
  site_id?: string;
  site_name?: string;
  name?: string;
}

export interface ZoomPhoneMetricCall {
  call_id?: string;
  direction?: string;
  duration?: number;
  date_time?: string;
  status?: string;
  result?: string;
  caller?: ZoomPhoneMetricParty;
  callee?: ZoomPhoneMetricParty;
  call_type?: string;
  owner?: ZoomPhoneOwner;
  matched_user?: ZoomPhoneCrmUserMatch;
  connected_number?: string;
  zoom_account?: string;
  live_status?: 'on_call' | 'available' | 'recent';
}

interface ZoomPhoneMetricsResponse {
  call_logs?: ZoomPhoneMetricCall[];
  next_page_token?: string;
  page_count?: number;
  page_size?: number;
  total_records?: number;
}

export interface ZoomPhoneLiveUser extends ZoomPhoneUser {
  matched_user?: ZoomPhoneCrmUserMatch;
  connected_numbers: string[];
  live_status: 'on_call' | 'available';
  active_call_id?: string;
}

export interface ZoomPhoneLiveStatusResponse {
  active_calls: ZoomPhoneMetricCall[];
  recent_calls: ZoomPhoneMetricCall[];
  phone_users: ZoomPhoneLiveUser[];
  inventory: ZoomPhoneInventoryResponse;
  updated_at: string;
}

export interface ZoomPhoneAnalyticsCall extends ZoomPhoneCallLog {
  normalized_direction: string;
  normalized_status: string;
  started_at?: string;
  agent_name: string;
  display_phone?: string;
  recording_count: number;
  has_recording: boolean;
  recording_download_url?: string;
}

export interface ZoomPhoneAgentAnalytics {
  agent: string;
  extension_number?: string;
  phone_number?: string;
  total_calls: number;
  incoming_calls: number;
  outgoing_calls: number;
  connected_calls: number;
  missed_calls: number;
  recorded_calls: number;
  total_talk_time: number;
  average_call_duration: number;
  answer_rate: number;
}

export interface ZoomPhoneDailyAnalytics {
  date: string;
  total_calls: number;
  incoming_calls: number;
  outgoing_calls: number;
  connected_calls: number;
  missed_calls: number;
  recorded_calls: number;
  total_talk_time: number;
}

export interface ZoomPhoneAnalyticsBreakdown {
  label: string;
  count: number;
  percentage: number;
}

export interface ZoomPhoneAnalyticsResponse {
  from: string;
  to: string;
  page_size: number;
  pages_scanned: number;
  total_records_scanned: number;
  call_logs: ZoomPhoneAnalyticsCall[];
  recordings: ZoomPhoneRecording[];
  recordings_error?: string;
  summary: {
    total_calls: number;
    incoming_calls: number;
    outgoing_calls: number;
    missed_calls: number;
    connected_calls: number;
    voicemail_calls: number;
    recorded_calls: number;
    answer_rate: number;
    average_call_duration: number;
    total_talk_time: number;
  };
  agent_stats: ZoomPhoneAgentAnalytics[];
  daily_stats: ZoomPhoneDailyAnalytics[];
  status_breakdown: ZoomPhoneAnalyticsBreakdown[];
  direction_breakdown: ZoomPhoneAnalyticsBreakdown[];
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

const buildAnalyticsMaxPages = (maxPages?: number) => {
  const configuredMax = getNumberValue(
    process.env.ZOOM_PHONE_ANALYTICS_MAX_PAGES,
    DEFAULT_ANALYTICS_MAX_PAGES,
    1,
    20
  );
  const requested = maxPages && Number.isFinite(maxPages) ? Math.trunc(maxPages) : configuredMax;
  return Math.min(Math.max(requested, 1), configuredMax, 20);
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

type CrmNumberMatch<TMatch> = {
  numbers: string[];
  searchText: string;
  match: TMatch;
};

interface CrmMatchContext {
  users: CrmNumberMatch<ZoomPhoneCrmUserMatch>[];
  leads: CrmNumberMatch<ZoomPhoneCrmLeadMatch>[];
  zoomUserAliases: Map<string, ZoomPhoneCrmUserMatch>;
}

const toTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const toIdString = (value: unknown) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'toString' in value) return String(value);
  return '';
};

const buildUserMatch = (user: Record<string, unknown>): ZoomPhoneCrmUserMatch => {
  const match: ZoomPhoneCrmUserMatch = {
    id: toIdString(user._id),
    name: toTrimmedString(user.name) || toTrimmedString(user.email) || 'CRM user'
  };
  const email = toTrimmedString(user.email);
  const phone = toTrimmedString(user.phone);
  match.isActive = user.isActive !== false;
  if (email) match.email = email;
  if (phone) match.phone = phone;
  return match;
};

const buildLeadMatch = (lead: Record<string, unknown>): ZoomPhoneCrmLeadMatch => {
  const match: ZoomPhoneCrmLeadMatch = {
    id: toIdString(lead._id),
    name: toTrimmedString(lead.name) || toTrimmedString(lead.email) || 'CRM lead'
  };
  const email = toTrimmedString(lead.email);
  const phone = toTrimmedString(lead.phone);
  if (email) match.email = email;
  if (phone) match.phone = phone;
  return match;
};

const buildNumberMatch = <TMatch>(
  values: Array<string | undefined>,
  searchValues: Array<string | undefined>,
  match: TMatch
): CrmNumberMatch<TMatch> => ({
  match,
  numbers: Array.from(new Set(values.flatMap(comparableNumbers))).filter(Boolean),
  searchText: searchValues.filter(Boolean).join(' ').toLowerCase()
});

const normalizeAliasKey = (value?: string) => String(value || '').toLowerCase().replace(/[^a-z0-9@.+]/g, '');

const addZoomAlias = (
  aliases: Map<string, ZoomPhoneCrmUserMatch>,
  value: string | undefined,
  match: ZoomPhoneCrmUserMatch | undefined
) => {
  if (!value || !match) return;
  const key = normalizeAliasKey(value);
  if (key) aliases.set(key, match);
};

const findZoomAliasMatch = (values: Array<string | undefined>, context: CrmMatchContext) => {
  for (const value of values) {
    const key = normalizeAliasKey(value);
    if (key && context.zoomUserAliases.has(key)) {
      return context.zoomUserAliases.get(key);
    }
  }
  return undefined;
};

const buildCrmMatchContext = async (inventory?: ZoomPhoneInventoryResponse): Promise<CrmMatchContext> => {
  const [users, leads] = await Promise.all([
    User.find({}).select('_id name email phone isActive').lean(),
    Lead.find({}).select('_id name email phone whatsapp zoomPhoneNumber').lean()
  ]);

  const userMatches = users
    .map((user) => {
      const record = user as Record<string, unknown>;
      const match = buildUserMatch(record);
      return buildNumberMatch(
        [toTrimmedString(record.phone)],
        [match.name, match.email, match.phone],
        match
      );
    })
    .filter((item) => item.numbers.length > 0 || item.searchText.length > 0);

  const leadMatches = leads
    .map((lead) => {
      const record = lead as Record<string, unknown>;
      const match = buildLeadMatch(record);
      return buildNumberMatch(
        [
          toTrimmedString(record.phone),
          toTrimmedString(record.whatsapp),
          toTrimmedString(record.zoomPhoneNumber)
        ],
        [match.name, match.email, match.phone],
        match
      );
    })
    .filter((item) => item.numbers.length > 0 || item.searchText.length > 0);

  const zoomUserAliases = new Map<string, ZoomPhoneCrmUserMatch>();

  if (inventory) {
    inventory.users.forEach((phoneUser) => {
      const connectedNumbers = getInventoryUserNumbers(phoneUser, inventory);
      const matchedUser =
        findPhoneMatch(connectedNumbers, userMatches) ||
        findTextMatch([phoneUser.email], userMatches);

      addZoomAlias(zoomUserAliases, phoneUser.id, matchedUser);
      addZoomAlias(zoomUserAliases, phoneUser.phone_user_id, matchedUser);
      addZoomAlias(zoomUserAliases, phoneUser.email, matchedUser);
      addZoomAlias(zoomUserAliases, phoneUser.name, matchedUser);
      addZoomAlias(zoomUserAliases, phoneUser.extension_number, matchedUser);
      connectedNumbers.forEach((number) => addZoomAlias(zoomUserAliases, number, matchedUser));
    });

    inventory.phone_numbers.forEach((phoneNumber) => {
      const matchedUser = findPhoneMatch(
        [phoneNumber.display_number, phoneNumber.number],
        userMatches
      );
      addZoomAlias(zoomUserAliases, phoneNumber.assignee?.id, matchedUser);
      addZoomAlias(zoomUserAliases, phoneNumber.assignee?.name, matchedUser);
      addZoomAlias(zoomUserAliases, phoneNumber.assignee?.extension_number, matchedUser);
      addZoomAlias(zoomUserAliases, phoneNumber.display_number, matchedUser);
      addZoomAlias(zoomUserAliases, phoneNumber.number, matchedUser);
    });
  }

  return {
    users: userMatches,
    leads: leadMatches,
    zoomUserAliases
  };
};

const phoneVariantsMatch = (first: string, second: string) => {
  if (!first || !second) return false;
  if (first === second) return true;
  return first.length >= 7 && second.length >= 7 && (first.endsWith(second) || second.endsWith(first));
};

const findPhoneMatch = <TMatch>(
  values: Array<string | undefined>,
  matches: CrmNumberMatch<TMatch>[]
): TMatch | undefined => {
  const variants = Array.from(new Set(values.flatMap(comparableNumbers))).filter(Boolean);
  if (variants.length === 0) return undefined;

  return matches.find((candidate) =>
    variants.some((variant) => candidate.numbers.some((storedNumber) => phoneVariantsMatch(variant, storedNumber)))
  )?.match;
};

const findTextMatch = <TMatch>(values: Array<string | undefined>, matches: CrmNumberMatch<TMatch>[]): TMatch | undefined => {
  const normalizedValues = values.map((value) => (value || '').trim().toLowerCase()).filter(Boolean);
  if (normalizedValues.length === 0) return undefined;

  return matches.find((candidate) =>
    Boolean(candidate.searchText) &&
    normalizedValues.some((value) => candidate.searchText.includes(value) || value.includes(candidate.searchText))
  )?.match;
};

const getAgentIdentityTextValues = (item: ZoomPhoneCallLog | ZoomPhoneRecording) => {
  const direction = normalizeDirection(item);
  const owner = item.owner;

  if (direction === 'Outgoing') {
    return [item.caller_name, owner?.name, owner?.id, owner?.extension_number, owner?.phone_number];
  }

  if (direction === 'Incoming') {
    return [item.callee_name, owner?.name, owner?.id, owner?.extension_number, owner?.phone_number];
  }

  return [
    owner?.name,
    owner?.id,
    owner?.extension_number,
    owner?.phone_number,
    item.caller_name,
    item.callee_name
  ];
};

const enrichZoomPhoneItem = <TItem extends ZoomPhoneCallLog | ZoomPhoneRecording>(
  item: TItem,
  context: CrmMatchContext
): TItem => {
  const enriched = { ...item } as TItem;
  const phoneValues = getCandidatePhoneValues(item);
  const matchedUser =
    findPhoneMatch(phoneValues, context.users) ||
    findZoomAliasMatch(getAgentIdentityTextValues(item), context);
  const matchedLead = findPhoneMatch(phoneValues, context.leads);

  if (matchedUser) enriched.matched_user = matchedUser;
  if (matchedLead) enriched.matched_lead = matchedLead;

  return enriched;
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

const buildZoomPageQuery = (query: ZoomPhoneQuery) => {
  const zoomQuery: Record<string, string> = {
    page_size: String(buildPageSize(query.pageSize))
  };

  if (query.nextPageToken) zoomQuery.next_page_token = query.nextPageToken;

  return zoomQuery;
};

const titleCase = (value?: string) => {
  const normalized = (value || '').replace(/[_-]+/g, ' ').trim();
  if (!normalized) return 'Unknown';
  return normalized
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const getCallStartedAt = (call: ZoomPhoneCallLog) =>
  call.date_time || call.answer_start_time || call.call_end_time || undefined;

const getCallDuration = (call: ZoomPhoneCallLog | ZoomPhoneRecording) => {
  const duration = Number(call.duration || 0);
  return Number.isFinite(duration) && duration > 0 ? Math.trunc(duration) : 0;
};

const normalizeDirection = (call: ZoomPhoneCallLog | ZoomPhoneRecording) => {
  const directionText = [call.direction, (call as ZoomPhoneCallLog).call_type, (call as ZoomPhoneCallLog).path]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (directionText.includes('incoming') || directionText.includes('inbound')) return 'Incoming';
  if (directionText.includes('outgoing') || directionText.includes('outbound')) return 'Outgoing';
  return 'Unknown';
};

const normalizeStatus = (call: ZoomPhoneCallLog) => {
  const statusText = [call.result, call.call_type, call.path].filter(Boolean).join(' ').toLowerCase();
  const duration = getCallDuration(call);

  if (statusText.includes('missed') || statusText.includes('no answer') || statusText.includes('unanswered')) {
    return 'Missed';
  }

  if (statusText.includes('voicemail') || statusText.includes('voice mail')) return 'Voicemail';
  if (statusText.includes('busy')) return 'Busy';
  if (statusText.includes('failed') || statusText.includes('error')) return 'Failed';
  if (statusText.includes('blocked')) return 'Blocked';
  if (
    duration > 0 ||
    statusText.includes('answered') ||
    statusText.includes('connected') ||
    statusText.includes('completed')
  ) {
    return 'Connected';
  }

  return titleCase(call.result || call.call_type || 'Unknown');
};

const getCallAgentName = (call: ZoomPhoneCallLog) =>
  call.owner?.name ||
  call.caller_name ||
  call.callee_name ||
  call.owner?.extension_number ||
  call.owner?.phone_number ||
  call.user_id ||
  'Unassigned';

const getDisplayPhone = (call: ZoomPhoneCallLog) =>
  call.caller_number ||
  call.callee_number ||
  call.caller_phone_number ||
  call.callee_phone_number ||
  call.caller_did_number ||
  call.callee_did_number ||
  call.owner?.phone_number ||
  '';

const getIdentityValues = (item: ZoomPhoneCallLog | ZoomPhoneRecording) => {
  const record = item as Record<string, unknown>;
  return ['id', 'call_id', 'call_log_id', 'call_element_id', 'recording_id']
    .map((key) => record[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
};

const buildRecordingIndex = (recordings: ZoomPhoneRecording[]) => {
  const index = new Map<string, ZoomPhoneRecording[]>();

  recordings.forEach((recording) => {
    getIdentityValues(recording).forEach((key) => {
      const existing = index.get(key) || [];
      existing.push(recording);
      index.set(key, existing);
    });
  });

  return index;
};

const getRecordingsForCall = (call: ZoomPhoneCallLog, index: Map<string, ZoomPhoneRecording[]>) => {
  const matches = new Map<string, ZoomPhoneRecording>();

  getIdentityValues(call).forEach((key) => {
    (index.get(key) || []).forEach((recording) => {
      const recordingKey = getRecordingIdentity(recording);
      if (recordingKey) matches.set(recordingKey, recording);
    });
  });

  return Array.from(matches.values());
};

const getRecordingIdentity = (recording: ZoomPhoneRecording) =>
  recording.id || recording.call_id || recording.call_log_id || recording.call_element_id || '';

const buildCallLogFromRecording = (recording: ZoomPhoneRecording): ZoomPhoneCallLog => {
  const callLog = {
    id: recording.call_log_id || recording.call_history_id || recording.call_id || recording.id,
    call_id: recording.call_id,
    source: 'recording' as const,
    direction: recording.direction,
    duration: recording.duration,
    date_time: recording.date_time,
    call_end_time: recording.end_time,
    caller_number: recording.caller_number,
    callee_number: recording.callee_number,
    caller_name: recording.caller_name,
    callee_name: recording.callee_name,
    result: 'Recorded',
    recording_id: recording.id,
    recording_type: recording.recording_type,
    owner: recording.owner,
    site: recording.site,
    matched_user: recording.matched_user,
    matched_lead: recording.matched_lead
  };

  return Object.fromEntries(
    Object.entries(callLog).filter(([, value]) => value !== undefined && value !== '')
  ) as ZoomPhoneCallLog;
};

const getMetricAgentParty = (call: ZoomPhoneMetricCall) => {
  const direction = (call.direction || call.call_type || '').toLowerCase();
  if (direction.includes('out')) return call.caller;
  if (direction.includes('in')) return call.callee;
  return call.caller || call.callee;
};

const buildCallLogFromMetric = (call: ZoomPhoneMetricCall): ZoomPhoneCallLog => {
  const agentParty = getMetricAgentParty(call);
  const callLog = {
    id: call.call_id,
    call_id: call.call_id,
    source: 'metrics' as const,
    call_type: call.call_type,
    direction: call.direction,
    duration: call.duration,
    date_time: call.date_time,
    caller_number: call.caller?.phone_number || call.caller?.extension_number,
    callee_number: call.callee?.phone_number || call.callee?.extension_number,
    caller_name: call.caller?.name,
    callee_name: call.callee?.name,
    result: call.result || call.status,
    owner: call.owner || {
      name: agentParty?.name,
      extension_number: agentParty?.extension_number ? String(agentParty.extension_number) : undefined,
      phone_number: agentParty?.phone_number
    },
    matched_user: call.matched_user,
    site: call.owner
      ? undefined
      : agentParty?.site_id || agentParty?.site_name
        ? {
            id: agentParty.site_id,
            name: agentParty.site_name
          }
        : undefined
  };

  return Object.fromEntries(
    Object.entries(callLog).filter(([, value]) => value !== undefined && value !== '')
  ) as ZoomPhoneCallLog;
};

const percentage = (part: number, total: number) => (total > 0 ? Number(((part / total) * 100).toFixed(1)) : 0);

const buildBreakdown = (items: string[], total: number): ZoomPhoneAnalyticsBreakdown[] => {
  const counts = new Map<string, number>();
  items.forEach((item) => counts.set(item || 'Unknown', (counts.get(item || 'Unknown') || 0) + 1));

  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      percentage: percentage(count, total)
    }))
    .sort((a, b) => b.count - a.count);
};

const fetchZoomPages = async <TResponse extends { next_page_token?: string }, TItem>(
  endpoint: string,
  listKey: keyof TResponse,
  query: ZoomPhoneQuery,
  includeDateRange = true
) => {
  const maxPages = buildAnalyticsMaxPages(query.maxPages);
  const items: TItem[] = [];
  let pagesScanned = 0;
  let nextPageToken = query.nextPageToken;
  let lastResponse: TResponse | null = null;

  do {
    const pageQuery: ZoomPhoneQuery = {
      ...query,
      pageSize: query.pageSize || MAX_ZOOM_PAGE_SIZE
    };

    if (nextPageToken) {
      pageQuery.nextPageToken = nextPageToken;
    }

    const response = await requestZoomJson<TResponse>(
      endpoint,
      includeDateRange ? buildZoomQuery(pageQuery) : buildZoomPageQuery(pageQuery)
    );

    const pageItems = response[listKey];
    if (Array.isArray(pageItems)) {
      items.push(...(pageItems as TItem[]));
    }

    pagesScanned += 1;
    nextPageToken = response.next_page_token;
    lastResponse = response;
  } while (nextPageToken && pagesScanned < maxPages);

  return {
    items,
    pagesScanned,
    nextPageToken,
    lastResponse
  };
};

const normalizeInventoryStatus = (value?: string) => (value || 'unknown').replace(/[_-]+/g, ' ').toLowerCase();

const hasAssignedNumber = (number: ZoomPhoneNumber) => Boolean(number.assignee?.id || number.assignee?.name);

const buildInventoryResponse = (
  phoneNumbers: ZoomPhoneNumber[],
  users: ZoomPhoneUser[],
  numberPagesScanned: number,
  userPagesScanned: number
): ZoomPhoneInventoryResponse => {
  const assignedNumbers = phoneNumbers.filter(hasAssignedNumber).length;
  const statusValues = phoneNumbers.map((number) => normalizeInventoryStatus(number.status));
  const userStatusValues = users.map((user) => normalizeInventoryStatus(user.activation_status || user.status));
  const capabilityValues = phoneNumbers.flatMap((number) => number.capability || []);
  const availableNumbers = phoneNumbers.filter((number) => normalizeInventoryStatus(number.status).includes('available')).length;
  const busyNumbers = phoneNumbers.filter((number) => normalizeInventoryStatus(number.status).includes('busy')).length;
  const inactiveNumbers = phoneNumbers.filter((number) => {
    const status = normalizeInventoryStatus(number.status);
    return status.includes('inactive') || status.includes('disabled') || status.includes('suspend');
  }).length;
  const activeUsers = users.filter((user) => {
    const status = normalizeInventoryStatus(user.activation_status || user.status);
    return status.includes('activated') || status.includes('activate') || status.includes('active');
  }).length;

  return {
    phone_numbers: phoneNumbers,
    users,
    summary: {
      total_numbers: phoneNumbers.length,
      assigned_numbers: assignedNumbers,
      unassigned_numbers: Math.max(phoneNumbers.length - assignedNumbers, 0),
      available_numbers: availableNumbers,
      busy_numbers: busyNumbers,
      inactive_numbers: inactiveNumbers,
      total_users: users.length,
      active_users: activeUsers,
      inactive_users: Math.max(users.length - activeUsers, 0)
    },
    number_status_breakdown: buildBreakdown(statusValues, phoneNumbers.length),
    user_status_breakdown: buildBreakdown(userStatusValues, users.length),
    capability_breakdown: buildBreakdown(capabilityValues, capabilityValues.length),
    pages_scanned: {
      numbers: numberPagesScanned,
      users: userPagesScanned
    }
  };
};

const fetchInventoryData = async (query: ZoomPhoneQuery) => {
  const [numberPages, userPages] = await Promise.all([
    fetchZoomPages<ZoomPhoneNumbersResponse, ZoomPhoneNumber>('/phone/numbers', 'phone_numbers', query, false),
    fetchZoomPages<ZoomPhoneUsersResponse, ZoomPhoneUser>('/phone/users', 'users', query, false)
  ]);

  return buildInventoryResponse(numberPages.items, userPages.items, numberPages.pagesScanned, userPages.pagesScanned);
};

const getMetricPartyValues = (party?: ZoomPhoneMetricParty) =>
  [party?.phone_number, party?.extension_number, party?.name].filter((value): value is string => Boolean(value));

const getMetricPhoneValues = (call: ZoomPhoneMetricCall) => [
  ...getMetricPartyValues(call.caller),
  ...getMetricPartyValues(call.callee),
  call.owner?.phone_number,
  call.owner?.extension_number
];

const getLikelyAgentValues = (call: ZoomPhoneMetricCall) => {
  const direction = (call.direction || call.call_type || '').toLowerCase();
  if (direction.includes('out')) return getMetricPartyValues(call.caller);
  if (direction.includes('in')) return getMetricPartyValues(call.callee);
  return getMetricPhoneValues(call);
};

const getLikelyConnectedNumber = (call: ZoomPhoneMetricCall) => {
  const direction = (call.direction || call.call_type || '').toLowerCase();
  if (direction.includes('out')) return call.callee?.phone_number || call.callee?.extension_number || '';
  if (direction.includes('in')) return call.caller?.phone_number || call.caller?.extension_number || '';
  return call.callee?.phone_number || call.caller?.phone_number || '';
};

const getLikelyZoomAccountNumber = (call: ZoomPhoneMetricCall) => {
  const direction = (call.direction || call.call_type || '').toLowerCase();
  if (direction.includes('out')) return call.caller?.phone_number || call.caller?.extension_number || '';
  if (direction.includes('in')) return call.callee?.phone_number || call.callee?.extension_number || '';
  return call.caller?.phone_number || call.callee?.phone_number || call.owner?.phone_number || '';
};

const isLiveMetricCall = (call: ZoomPhoneMetricCall) => {
  const statusText = [call.status, call.result, call.call_type, call.direction]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const duration = Number(call.duration);
  const startedAt = new Date(call.date_time || 0).getTime();
  const isVeryRecent = Number.isFinite(startedAt) && Date.now() - startedAt <= 15 * 60 * 1000;
  const isCompleted =
    statusText.includes('miss') ||
    statusText.includes('voicemail') ||
    statusText.includes('no answer') ||
    statusText.includes('complete') ||
    statusText.includes('answered') ||
    statusText.includes('connect');

  return (
    statusText.includes('ring') ||
    statusText.includes('active') ||
    statusText.includes('progress') ||
    statusText.includes('ongoing') ||
    statusText.includes('hold') ||
    statusText.includes('park') ||
    ((!Number.isFinite(duration) || duration <= 0) && isVeryRecent && !isCompleted)
  );
};

const enrichMetricCall = (call: ZoomPhoneMetricCall, context: CrmMatchContext): ZoomPhoneMetricCall => {
  const enriched: ZoomPhoneMetricCall = { ...call };
  const matchedUser =
    findPhoneMatch(getLikelyAgentValues(call), context.users) ||
    findTextMatch([call.caller?.name, call.callee?.name, call.owner?.name], context.users);

  if (matchedUser) enriched.matched_user = matchedUser;

  const connectedNumber = getLikelyConnectedNumber(call);
  const zoomAccount = getLikelyZoomAccountNumber(call);
  if (connectedNumber) enriched.connected_number = connectedNumber;
  if (zoomAccount) enriched.zoom_account = zoomAccount;
  enriched.live_status = isLiveMetricCall(call) ? 'on_call' : 'recent';

  return enriched;
};

const getInventoryUserNumbers = (phoneUser: ZoomPhoneUser, inventory: ZoomPhoneInventoryResponse) => {
  const directNumbers = (phoneUser.phone_numbers || []).map((phoneNumber) => phoneNumber.display_number || phoneNumber.number);
  const assignedNumbers = inventory.phone_numbers
    .filter((phoneNumber) => {
      const assignee = phoneNumber.assignee;
      if (!assignee) return false;
      return (
        assignee.id === phoneUser.id ||
        assignee.id === phoneUser.phone_user_id ||
        assignee.extension_number === phoneUser.extension_number ||
        assignee.name === phoneUser.name
      );
    })
    .map((phoneNumber) => phoneNumber.display_number || phoneNumber.number);

  return Array.from(new Set([...directNumbers, ...assignedNumbers].filter((value): value is string => Boolean(value))));
};

const matchInventoryUser = (
  phoneUser: ZoomPhoneUser,
  connectedNumbers: string[],
  context: CrmMatchContext
): ZoomPhoneCrmUserMatch | undefined =>
  findPhoneMatch(connectedNumbers, context.users) ||
  findTextMatch([phoneUser.email, phoneUser.name], context.users);

const buildLiveStatusResponse = async (query: ZoomPhoneQuery): Promise<ZoomPhoneLiveStatusResponse> => {
  const inventory = await fetchInventoryData(query);
  const context = await buildCrmMatchContext(inventory);
  const metricPages = await fetchZoomPages<ZoomPhoneMetricsResponse, ZoomPhoneMetricCall>(
    '/phone/metrics/call_logs',
    'call_logs',
    {
      ...query,
      from: query.from || toDateParam(new Date()),
      to: query.to || toDateParam(new Date()),
      pageSize: query.pageSize || 100,
      maxPages: query.maxPages || 2
    }
  );

  const recentCalls = metricPages.items
    .map((call) => enrichMetricCall(call, context))
    .sort((a, b) => new Date(b.date_time || 0).getTime() - new Date(a.date_time || 0).getTime());
  const activeCalls = recentCalls.filter((call) => call.live_status === 'on_call');

  const phoneUsers = inventory.users.map((phoneUser) => {
    const connectedNumbers = getInventoryUserNumbers(phoneUser, inventory);
    const liveUser: ZoomPhoneLiveUser = {
      ...phoneUser,
      connected_numbers: connectedNumbers,
      live_status: 'available'
    };
    const matchedUser = matchInventoryUser(phoneUser, connectedNumbers, context);
    if (matchedUser) liveUser.matched_user = matchedUser;

    const activeCall = activeCalls.find((call) => {
      if (matchedUser && call.matched_user?.id === matchedUser.id) return true;
      return findPhoneMatch(getMetricPhoneValues(call), [
        {
          numbers: connectedNumbers.flatMap(comparableNumbers),
          searchText: '',
          match: true
        }
      ]);
    });

    if (activeCall) {
      liveUser.live_status = 'on_call';
      if (activeCall.call_id) liveUser.active_call_id = activeCall.call_id;
    }

    return liveUser;
  });

  return {
    active_calls: activeCalls,
    recent_calls: recentCalls.slice(0, 25),
    phone_users: phoneUsers,
    inventory,
    updated_at: new Date().toISOString()
  };
};

const buildAnalyticsResponse = (
  query: ZoomPhoneQuery,
  callLogs: ZoomPhoneCallLog[],
  recordings: ZoomPhoneRecording[],
  pagesScanned: number,
  recordingsError?: string
): ZoomPhoneAnalyticsResponse => {
  const { from, to } = buildDateRange(query);
  const recordingIndex = buildRecordingIndex(recordings);
  const sourceCallLogs = callLogs.length > 0 ? callLogs : recordings.map(buildCallLogFromRecording);
  const normalizedCalls = sourceCallLogs.map((call) => {
    const matchedRecordings = getRecordingsForCall(call, recordingIndex);
    const recordingDownloadUrl = matchedRecordings[0]?.download_url || matchedRecordings[0]?.file_url;
    const startedAt = getCallStartedAt(call);
    const isMetricsCallWithoutResult = call.source === 'metrics' && !call.result && !call.path;
    const normalizedStatus = isMetricsCallWithoutResult
      ? matchedRecordings.length > 0
        ? 'Connected'
        : 'Unknown'
      : normalizeStatus(call);
    const normalizedCall: ZoomPhoneAnalyticsCall = {
      ...call,
      normalized_direction: normalizeDirection(call),
      normalized_status: normalizedStatus,
      agent_name: call.matched_user?.name || getCallAgentName(call),
      display_phone: call.matched_lead?.phone || getDisplayPhone(call),
      recording_count: matchedRecordings.length,
      has_recording: matchedRecordings.length > 0 || Boolean(call.recording_id || call.recording_type)
    };

    if (startedAt) {
      normalizedCall.started_at = startedAt;
    }

    if (recordingDownloadUrl) {
      normalizedCall.recording_download_url = recordingDownloadUrl;
    }

    return normalizedCall;
  });

  const totalCalls = normalizedCalls.length;
  const incomingCalls = normalizedCalls.filter((call) => call.normalized_direction === 'Incoming').length;
  const outgoingCalls = normalizedCalls.filter((call) => call.normalized_direction === 'Outgoing').length;
  const missedCalls = normalizedCalls.filter((call) => call.normalized_status === 'Missed').length;
  const connectedCalls = normalizedCalls.filter((call) => call.normalized_status === 'Connected').length;
  const voicemailCalls = normalizedCalls.filter((call) => call.normalized_status === 'Voicemail').length;
  const recordedCalls = normalizedCalls.filter((call) => call.has_recording).length;
  const totalTalkTime = normalizedCalls.reduce((sum, call) => sum + getCallDuration(call), 0);

  const agentMap = new Map<string, ZoomPhoneAgentAnalytics>();
  const dayMap = new Map<string, ZoomPhoneDailyAnalytics>();

  normalizedCalls.forEach((call) => {
    const duration = getCallDuration(call);
    const agentKey = call.agent_name || 'Unassigned';
    const existingAgentStats = agentMap.get(agentKey);
    const agentStats =
      existingAgentStats ||
      ({
        agent: agentKey,
        total_calls: 0,
        incoming_calls: 0,
        outgoing_calls: 0,
        connected_calls: 0,
        missed_calls: 0,
        recorded_calls: 0,
        total_talk_time: 0,
        average_call_duration: 0,
        answer_rate: 0
      } satisfies ZoomPhoneAgentAnalytics);

    if (!existingAgentStats && call.owner?.extension_number) {
      agentStats.extension_number = call.owner.extension_number;
    }

    if (!existingAgentStats && call.owner?.phone_number) {
      agentStats.phone_number = call.owner.phone_number;
    }

    agentStats.total_calls += 1;
    agentStats.incoming_calls += call.normalized_direction === 'Incoming' ? 1 : 0;
    agentStats.outgoing_calls += call.normalized_direction === 'Outgoing' ? 1 : 0;
    agentStats.connected_calls += call.normalized_status === 'Connected' ? 1 : 0;
    agentStats.missed_calls += call.normalized_status === 'Missed' ? 1 : 0;
    agentStats.recorded_calls += call.has_recording ? 1 : 0;
    agentStats.total_talk_time += duration;
    agentMap.set(agentKey, agentStats);

    const startedAt = call.started_at || to;
    const dateKey = startedAt.slice(0, 10);
    const dayStats =
      dayMap.get(dateKey) ||
      ({
        date: dateKey,
        total_calls: 0,
        incoming_calls: 0,
        outgoing_calls: 0,
        connected_calls: 0,
        missed_calls: 0,
        recorded_calls: 0,
        total_talk_time: 0
      } satisfies ZoomPhoneDailyAnalytics);

    dayStats.total_calls += 1;
    dayStats.incoming_calls += call.normalized_direction === 'Incoming' ? 1 : 0;
    dayStats.outgoing_calls += call.normalized_direction === 'Outgoing' ? 1 : 0;
    dayStats.connected_calls += call.normalized_status === 'Connected' ? 1 : 0;
    dayStats.missed_calls += call.normalized_status === 'Missed' ? 1 : 0;
    dayStats.recorded_calls += call.has_recording ? 1 : 0;
    dayStats.total_talk_time += duration;
    dayMap.set(dateKey, dayStats);
  });

  const agentStats = Array.from(agentMap.values())
    .map((agent) => ({
      ...agent,
      average_call_duration:
        agent.connected_calls > 0 ? Math.round(agent.total_talk_time / agent.connected_calls) : 0,
      answer_rate: percentage(agent.connected_calls, agent.total_calls)
    }))
    .sort((a, b) => b.total_calls - a.total_calls);

  const response: ZoomPhoneAnalyticsResponse = {
    from,
    to,
    page_size: buildPageSize(query.pageSize),
    pages_scanned: pagesScanned,
    total_records_scanned: totalCalls,
    call_logs: normalizedCalls.sort((a, b) => {
      const first = new Date(a.started_at || 0).getTime();
      const second = new Date(b.started_at || 0).getTime();
      return second - first;
    }),
    recordings,
    summary: {
      total_calls: totalCalls,
      incoming_calls: incomingCalls,
      outgoing_calls: outgoingCalls,
      missed_calls: missedCalls,
      connected_calls: connectedCalls,
      voicemail_calls: voicemailCalls,
      recorded_calls: recordedCalls,
      answer_rate: percentage(connectedCalls, totalCalls),
      average_call_duration: connectedCalls > 0 ? Math.round(totalTalkTime / connectedCalls) : 0,
      total_talk_time: totalTalkTime
    },
    agent_stats: agentStats,
    daily_stats: Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    status_breakdown: buildBreakdown(
      normalizedCalls.map((call) => call.normalized_status),
      totalCalls
    ),
    direction_breakdown: buildBreakdown(
      normalizedCalls.map((call) => call.normalized_direction),
      totalCalls
    )
  };

  if (recordingsError) {
    response.recordings_error = recordingsError;
  }

  return response;
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

const requestZoomFile = async (
  urlOrEndpoint: string,
  range?: string,
  retry = true
): Promise<Response> => {
  const token = await getZoomAccessToken();

  const isAbsolute = /^https?:\/\//i.test(urlOrEndpoint);
  const url = isAbsolute
    ? urlOrEndpoint
    : `${ZOOM_API_BASE_URL}${urlOrEndpoint}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`
  };

  if (range) {
    headers.Range = range;
  }

  const response = await fetch(url, {
    headers
  });

  if (response.status === 401 && retry) {
    tokenCache = null;
    return requestZoomFile(urlOrEndpoint, range, false);
  }

  if (!response.ok && response.status !== 206) {
    const details = await response.text();

    const error = new Error(
      `Zoom recording download failed (${response.status}): ${details.slice(
        0,
        300
      )}`
    );

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

  getAccountRecordings: async (query: ZoomPhoneQuery) => {
    const [inventory, response] = await Promise.all([
      fetchInventoryData({ pageSize: 300, maxPages: 2 }).catch(() => undefined),
      requestZoomJson<ZoomRecordingsResponse>('/phone/recordings', buildZoomQuery(query))
    ]);
    const context = await buildCrmMatchContext(inventory);

    return {
      ...response,
      recordings: (response.recordings || []).map((recording) => enrichZoomPhoneItem(recording, context))
    };
  },

  getAccountInventory: async (query: ZoomPhoneQuery) => {
    return fetchInventoryData(query);
  },

  getAccountLiveStatus: async (query: ZoomPhoneQuery) => {
    return buildLiveStatusResponse(query);
  },

  getAccountAnalytics: async (query: ZoomPhoneQuery) => {
    const [inventory, metricPages] = await Promise.all([
      fetchInventoryData({ pageSize: 300, maxPages: 2 }).catch(() => undefined),
      fetchZoomPages<ZoomPhoneMetricsResponse, ZoomPhoneMetricCall>('/phone/metrics/call_logs', 'call_logs', query)
    ]);
    const context = await buildCrmMatchContext(inventory);
    let callLogs = metricPages.items.map((call) => buildCallLogFromMetric(enrichMetricCall(call, context)));
    let pagesScanned = metricPages.pagesScanned;

    if (callLogs.length === 0) {
      const callLogPages = await fetchZoomPages<ZoomCallLogsResponse, ZoomPhoneCallLog>('/phone/call_logs', 'call_logs', query);
      callLogs = callLogPages.items.map((call) => enrichZoomPhoneItem({ ...call, source: 'call_log' as const }, context));
      pagesScanned = callLogPages.pagesScanned;
    }

    let recordings: ZoomPhoneRecording[] = [];
    let recordingsError: string | undefined;

    if (query.includeRecordings !== false) {
      try {
        const recordingPages = await fetchZoomPages<ZoomRecordingsResponse, ZoomPhoneRecording>(
          '/phone/recordings',
          'recordings',
          query
        );
        recordings = recordingPages.items;
      } catch (error) {
        recordingsError = error instanceof Error ? error.message : 'Unable to retrieve Zoom Phone recordings';
      }
    }

    return buildAnalyticsResponse(
      query,
      callLogs.map((call) => enrichZoomPhoneItem(call, context)),
      recordings.map((recording) => enrichZoomPhoneItem(recording, context)),
      pagesScanned,
      recordingsError
    );
  },

  getLeadCallHistory: async (lead: ILead, query: ZoomPhoneQuery) => {
    const [inventory, response] = await Promise.all([
      fetchInventoryData({ pageSize: 300, maxPages: 2 }).catch(() => undefined),
      requestZoomJson<ZoomCallLogsResponse>('/phone/call_logs', buildZoomQuery(query))
    ]);
    const context = await buildCrmMatchContext(inventory);
    const leadNumbers = getLeadZoomNumbers(lead);
    let callLogs = (response.call_logs || [])
      .filter((call) => phoneMatchesLead(call, leadNumbers))
      .map((call) => enrichZoomPhoneItem(call, context));
    let recordings: ZoomPhoneRecording[] = [];

    try {
      const recordingResponse = await requestZoomJson<ZoomRecordingsResponse>('/phone/recordings', buildZoomQuery(query));
      recordings = (recordingResponse.recordings || [])
        .filter((recording) => phoneMatchesLead(recording, leadNumbers))
        .map((recording) => enrichZoomPhoneItem(recording, context));
      if (callLogs.length === 0 && recordings.length > 0) {
        callLogs = recordings.map(buildCallLogFromRecording);
      }
    } catch {
      recordings = [];
    }

    return {
      ...response,
      call_logs: callLogs,
      total_records: callLogs.length,
      recordings,
      matched_numbers: leadNumbers
    };
  },

  getLeadRecordings: async (lead: ILead, query: ZoomPhoneQuery) => {
    const [inventory, response] = await Promise.all([
      fetchInventoryData({ pageSize: 300, maxPages: 2 }).catch(() => undefined),
      requestZoomJson<ZoomRecordingsResponse>('/phone/recordings', buildZoomQuery(query))
    ]);
    const context = await buildCrmMatchContext(inventory);
    const leadNumbers = getLeadZoomNumbers(lead);
    const recordings = (response.recordings || [])
      .filter((recording) => phoneMatchesLead(recording, leadNumbers))
      .map((recording) => enrichZoomPhoneItem(recording, context));

    return {
      ...response,
      recordings,
      total_records: recordings.length,
      matched_numbers: leadNumbers
    };
  },

  getCallLogRecordings: async (lead: ILead, callLogId: string) => {
    const [inventory, response] = await Promise.all([
      fetchInventoryData({ pageSize: 300, maxPages: 2 }).catch(() => undefined),
      requestZoomJson<ZoomRecordingsResponse>(`/phone/call_logs/${encodeURIComponent(callLogId)}/recordings`)
    ]);
    const context = await buildCrmMatchContext(inventory);
    const leadNumbers = getLeadZoomNumbers(lead);
    const recordings = (response.recordings || [])
      .filter((recording) => phoneMatchesLead(recording, leadNumbers))
      .map((recording) => enrichZoomPhoneItem(recording, context));

    return {
      ...response,
      recordings,
      total_records: recordings.length,
      matched_numbers: leadNumbers
    };
  },

  downloadRecording: async (
    recordingId: string,
    downloadUrl?: string,
    range?: string
  ) => {
    const safeDownloadUrl = assertZoomDownloadUrl(downloadUrl);
  
    if (safeDownloadUrl) {
      return requestZoomFile(safeDownloadUrl, range);
    }
  
    return requestZoomFile(
      `/phone/recording/download/${encodeURIComponent(recordingId)}`,
      range
    );
  }
};
