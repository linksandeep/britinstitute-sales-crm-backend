export interface TalkTimeCall {
  id?: string;
  call_element_id?: string;
  call_id?: string;
  start_time?: string;
  date_time?: string;
  answer_time?: string;
  answer_start_time?: string;
  end_time?: string;
  call_end_time?: string;
  talk_time?: number;
  result?: string;
  call_result?: string;
  direction?: string;
  caller_did_number?: string;
  callee_did_number?: string;
  caller_number?: string;
  callee_number?: string;
}

export interface ZoomCallSummary {
  from: string;
  to: string;
  talk_time_seconds: number;
  total_calls: number;
  inbound_calls: number;
  outbound_calls: number;
  connected_calls: number;
  connected_outbound_calls: number;
  unique_contacts: number;
  unique_outbound_contacts: number;
  connected_unique_contacts: number;
}

export const getTalkTimeDate = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
};

export const getTalkTimeRange = (timeZone: string, now = new Date()) => {
  const today = getTalkTimeDate(now, timeZone);
  const weekStart = new Date(`${today}T00:00:00Z`);
  // Match the CRM's existing Sunday-to-today weekly reports.
  weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
  const from = weekStart.toISOString().slice(0, 10);
  const queryFrom = new Date(weekStart);
  queryFrom.setUTCDate(queryFrom.getUTCDate() - 1);
  const queryTo = new Date(`${today}T00:00:00Z`);
  queryTo.setUTCDate(queryTo.getUTCDate() + 1);
  return { today, from, queryFrom: queryFrom.toISOString().slice(0, 10), queryTo: queryTo.toISOString().slice(0, 10) };
};

const normalizeContactNumber = (value?: string) => (value || '').replace(/\D/g, '');

export const sumZoomCallSummary = (
  calls: TalkTimeCall[],
  timeZone: string,
  from: string,
  to: string,
  now = new Date()
): ZoomCallSummary => {
  const callIds = new Set<string>();
  const inboundCallIds = new Set<string>();
  const outboundCallIds = new Set<string>();
  const connectedCallIds = new Set<string>();
  const connectedOutboundCallIds = new Set<string>();
  const contacts = new Set<string>();
  const outboundContacts = new Set<string>();
  const connectedContacts = new Set<string>();
  const seenElements = new Set<string>();
  let talkTimeSeconds = 0;

  for (const call of calls) {
    const startedAt = call.start_time || call.date_time || call.answer_time || call.answer_start_time;
    if (!startedAt) continue;
    const timestamp = new Date(startedAt);
    if (!Number.isFinite(timestamp.getTime()) || timestamp > now) continue;
    const date = getTalkTimeDate(timestamp, timeZone);
    if (date < from || date > to) continue;

    const elementKey = call.call_element_id || call.id ||
      `${call.call_id || ''}:${startedAt}:${call.direction || ''}:${call.caller_did_number || call.caller_number || ''}:${call.callee_did_number || call.callee_number || ''}`;
    const callId = call.call_id || elementKey;
    const direction = (call.direction || '').toLowerCase();
    const isOutbound = /outbound|outgoing/.test(direction);
    const isInbound = /inbound|incoming/.test(direction);
    const contact = normalizeContactNumber(
      isOutbound
        ? call.callee_did_number || call.callee_number
        : isInbound
          ? call.caller_did_number || call.caller_number
          : undefined
    );

    callIds.add(callId);
    if (isOutbound) outboundCallIds.add(callId);
    if (isInbound) inboundCallIds.add(callId);
    if (contact) {
      contacts.add(contact);
      if (isOutbound) outboundContacts.add(contact);
    }

    const result = (call.result || call.call_result || '').toLowerCase().replace(/[_-]/g, ' ');
    if (/missed|no answer|unanswered|voicemail|busy|failed|blocked|rejected|cancel|other member|answered by other/.test(result)) continue;

    let seconds = Number(call.talk_time);
    if (call.talk_time == null) {
      const answer = call.answer_time || call.answer_start_time;
      const end = call.end_time || call.call_end_time;
      seconds = answer && end ? (Date.parse(end) - Date.parse(answer)) / 1000 : 0;
    }
    if (!Number.isFinite(seconds) || seconds <= 0) continue;

    connectedCallIds.add(callId);
    if (isOutbound) connectedOutboundCallIds.add(callId);
    if (contact) connectedContacts.add(contact);
    if (seenElements.has(elementKey)) continue;
    seenElements.add(elementKey);
    talkTimeSeconds += Math.trunc(seconds);
  }

  return {
    from,
    to,
    talk_time_seconds: talkTimeSeconds,
    total_calls: callIds.size,
    inbound_calls: inboundCallIds.size,
    outbound_calls: outboundCallIds.size,
    connected_calls: connectedCallIds.size,
    connected_outbound_calls: connectedOutboundCallIds.size,
    unique_contacts: contacts.size,
    unique_outbound_contacts: outboundContacts.size,
    connected_unique_contacts: connectedContacts.size
  };
};

export const sumZoomTalkTime = (calls: TalkTimeCall[], timeZone: string, now = new Date()) => {
  const range = getTalkTimeRange(timeZone, now);
  const dailySummary = sumZoomCallSummary(calls, timeZone, range.today, range.today, now);
  const weeklySummary = sumZoomCallSummary(calls, timeZone, range.from, range.today, now);
  const daily = {
    ...dailySummary,
    date: range.today,
    total_connected_calls: dailySummary.connected_calls,
    connected_calls: dailySummary.connected_outbound_calls,
    dialed_calls: dailySummary.outbound_calls
  };
  const weekly = {
    ...weeklySummary,
    total_connected_calls: weeklySummary.connected_calls,
    connected_calls: weeklySummary.connected_outbound_calls,
    dialed_calls: weeklySummary.outbound_calls
  };
  return { daily, weekly, timezone: timeZone, updated_at: now.toISOString() };
};
