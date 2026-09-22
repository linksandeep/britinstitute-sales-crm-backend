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

export const sumZoomTalkTime = (calls: TalkTimeCall[], timeZone: string, now = new Date()) => {
  const range = getTalkTimeRange(timeZone, now);
  const daily = { date: range.today, talk_time_seconds: 0, connected_calls: 0, dialed_calls: 0 };
  const weekly = { from: range.from, to: range.today, talk_time_seconds: 0, connected_calls: 0, dialed_calls: 0 };
  const seen = new Set<string>();
  const dailyCalls = new Set<string>();
  const weeklyCalls = new Set<string>();
  const dailyDialedCalls = new Set<string>();
  const weeklyDialedCalls = new Set<string>();
  for (const call of calls) {
    const startedAt = call.start_time || call.date_time || call.answer_time || call.answer_start_time;
    if (!startedAt) continue;
    const timestamp = new Date(startedAt);
    if (!Number.isFinite(timestamp.getTime()) || timestamp > now) continue;
    const date = getTalkTimeDate(timestamp, timeZone);
    if (date < range.from || date > range.today) continue;
    const key = call.call_element_id || call.id ||
      `${call.call_id || ''}:${startedAt}:${call.direction || ''}:${call.caller_did_number || ''}:${call.callee_did_number || ''}`;
    const callId = call.call_id || key;
    const isOutbound = /outbound|outgoing/i.test(call.direction || '');
    if (isOutbound) {
      weeklyDialedCalls.add(callId);
      if (date === range.today) dailyDialedCalls.add(callId);
    }
    const result = (call.result || call.call_result || '').toLowerCase().replace(/[_-]/g, ' ');
    if (/missed|no answer|unanswered|voicemail|busy|failed|blocked|rejected|cancel|other member|answered by other/.test(result)) continue;
    // Prefer Zoom's talk_time; total duration can include ringing and waiting.
    let seconds = Number(call.talk_time);
    if (call.talk_time == null) {
      const answer = call.answer_time || call.answer_start_time;
      const end = call.end_time || call.call_end_time;
      seconds = answer && end ? (Date.parse(end) - Date.parse(answer)) / 1000 : 0;
    }
    if (!Number.isFinite(seconds) || seconds <= 0) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    seconds = Math.trunc(seconds);
    if (seconds === 0) continue;
    weekly.talk_time_seconds += seconds;
    // Connected calls are answered outbound calls with a real conversation.
    // Incoming calls can contribute to talk time, but are not calls the user dialed.
    if (isOutbound) weeklyCalls.add(callId);
    if (date === range.today) {
      daily.talk_time_seconds += seconds;
      if (isOutbound) dailyCalls.add(callId);
    }
  }
  daily.connected_calls = dailyCalls.size;
  weekly.connected_calls = weeklyCalls.size;
  daily.dialed_calls = dailyDialedCalls.size;
  weekly.dialed_calls = weeklyDialedCalls.size;
  return { daily, weekly, timezone: timeZone, updated_at: now.toISOString() };
};
