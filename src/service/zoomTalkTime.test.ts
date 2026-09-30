import assert from 'node:assert/strict';
import test from 'node:test';
import { getTalkTimeRange, sumZoomCallSummary, sumZoomTalkTime } from './zoomTalkTime';

const now = new Date('2026-09-15T12:00:00Z');

test('separates today from Sunday-to-today and excludes old and future calls', () => {
  const result = sumZoomTalkTime([
    { id: 'today', start_time: '2026-09-15T10:00:00Z', talk_time: 125, direction: 'outbound' },
    { id: 'sunday', start_time: '2026-09-13T10:00:00Z', talk_time: 3600, direction: 'incoming' },
    { id: 'old', start_time: '2026-09-12T10:00:00Z', talk_time: 999, direction: 'outbound' },
    { id: 'future', start_time: '2026-09-15T13:00:00Z', talk_time: 999, direction: 'outbound' }
  ], 'UTC', now);
  assert.equal(result.daily.date, '2026-09-15');
  assert.equal(result.daily.talk_time_seconds, 125);
  assert.equal(result.daily.connected_calls, 1);
  assert.equal(result.daily.dialed_calls, 1);
  assert.equal(result.weekly.from, '2026-09-13');
  assert.equal(result.weekly.to, '2026-09-15');
  assert.equal(result.weekly.talk_time_seconds, 3725);
  assert.equal(result.weekly.connected_calls, 1);
  assert.equal(result.weekly.dialed_calls, 1);
});

test('reports call attempts and unique external contacts with explicit definitions', () => {
  const result = sumZoomCallSummary([
    { call_id: 'out-1', call_element_id: 'out-1-a', start_time: '2026-09-15T09:00:00Z', direction: 'outbound', callee_did_number: '+44 7700 900001', talk_time: 60 },
    { call_id: 'out-2', call_element_id: 'out-2-a', start_time: '2026-09-15T10:00:00Z', direction: 'outbound', callee_did_number: '+44 7700 900001', result: 'no_answer' },
    { call_id: 'in-1', call_element_id: 'in-1-a', start_time: '2026-09-15T11:00:00Z', direction: 'incoming', caller_did_number: '+44 7700 900002', talk_time: 30 }
  ], 'UTC', '2026-09-15', '2026-09-15', now);

  assert.equal(result.total_calls, 3);
  assert.equal(result.outbound_calls, 2);
  assert.equal(result.inbound_calls, 1);
  assert.equal(result.connected_outbound_calls, 1);
  assert.equal(result.unique_contacts, 2);
  assert.equal(result.unique_outbound_contacts, 1);
  assert.equal(result.talk_time_seconds, 90);
});

test('uses local calendar boundaries on either side of UTC', () => {
  const earlyNow = new Date('2026-09-15T01:00:00Z');
  const calls = [{ id: 'call', start_time: '2026-09-14T23:30:00Z', talk_time: 60 }];
  assert.equal(sumZoomTalkTime(calls, 'Asia/Kolkata', earlyNow).daily.talk_time_seconds, 60);
  assert.equal(sumZoomTalkTime(calls, 'UTC', earlyNow).daily.talk_time_seconds, 0);
  assert.equal(sumZoomTalkTime(calls, 'America/Los_Angeles', earlyNow).daily.date, '2026-09-14');
});

test('handles timezone daylight-saving changes and Sunday rollover', () => {
  const dstNow = new Date('2026-10-25T12:00:00Z');
  const result = sumZoomTalkTime([
    { id: 'local-sunday', start_time: '2026-10-24T23:30:00Z', talk_time: 90 },
    { id: 'post-change', start_time: '2026-10-25T01:30:00Z', talk_time: 120 }
  ], 'Europe/London', dstNow);
  assert.equal(result.daily.talk_time_seconds, 210);
  assert.equal(result.weekly.from, '2026-10-25');
  assert.equal(getTalkTimeRange('Asia/Kolkata', now).queryFrom, '2026-09-12');
});

test('deduplicates elements while preserving separate transferred call segments', () => {
  const call = { call_element_id: 'element-1', call_id: 'same-call', start_time: '2026-09-15T10:00:00Z', talk_time: 60, direction: 'outbound' };
  const result = sumZoomTalkTime([call, call, { ...call, call_element_id: 'element-2', talk_time: 120 }], 'UTC', now);
  assert.equal(result.daily.talk_time_seconds, 180);
  assert.equal(result.daily.connected_calls, 1);
  assert.equal(result.daily.dialed_calls, 1);
});

test('excludes unsuccessful calls, invalid values, and ringing-only durations', () => {
  const calls = ['missed', 'no_answer', 'voicemail', 'busy', 'call_failed', 'Answered by Other Member'].map((result) =>
    ({ id: result, result, start_time: '2026-09-15T10:00:00Z', talk_time: 60 }));
  const result = sumZoomTalkTime([
    ...calls,
    { id: 'bad', start_time: 'invalid', talk_time: 60 },
    { id: 'negative', start_time: '2026-09-15T10:00:00Z', talk_time: -1 },
    { id: 'ringing', start_time: '2026-09-15T10:00:00Z' }
  ], 'UTC', now);
  assert.equal(result.weekly.talk_time_seconds, 0);
});

test('counts unique outbound attempts whether or not they connected', () => {
  const result = sumZoomTalkTime([
    { call_element_id: 'failed-leg', call_id: 'failed-call', start_time: '2026-09-15T09:00:00Z', direction: 'outbound', result: 'no_answer' },
    { call_element_id: 'failed-leg-copy', call_id: 'failed-call', start_time: '2026-09-15T09:00:00Z', direction: 'outbound', result: 'no_answer' },
    { id: 'busy-call', start_time: '2026-09-15T09:30:00Z', direction: 'outgoing', result: 'busy' },
    { id: 'connected-call', start_time: '2026-09-15T10:00:00Z', direction: 'outbound', result: 'connected', talk_time: 45 },
    { id: 'incoming-call', start_time: '2026-09-15T11:00:00Z', direction: 'incoming', result: 'connected', talk_time: 30 }
  ], 'UTC', now);
  assert.equal(result.daily.dialed_calls, 3);
  assert.equal(result.daily.connected_calls, 1);
  assert.equal(result.daily.talk_time_seconds, 75);
});

test('falls back to answered duration and treats explicit zero talk time as zero', () => {
  const call = { start_time: '2026-09-15T10:00:00Z', answer_time: '2026-09-15T10:00:30Z', end_time: '2026-09-15T10:02:30Z', direction: 'outbound' };
  const result = sumZoomTalkTime([{ ...call, id: 'fallback' }, { ...call, id: 'zero', talk_time: 0 }], 'UTC', now);
  assert.equal(result.daily.talk_time_seconds, 120);
  assert.equal(result.daily.connected_calls, 1);
});
