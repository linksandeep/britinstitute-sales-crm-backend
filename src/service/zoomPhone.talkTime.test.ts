import assert from 'node:assert/strict';
import test from 'node:test';
import User from '../models/User';
import ZoomPhoneNumberAssignment from '../models/ZoomPhoneNumberAssignment';
import { zoomPhoneService } from './zoomPhone.service';
import { getMyZoomTalkTime } from '../controllers/zoomPhoneController';
import type { Request, Response } from 'express';

test('fetches all pages and attributes a shared account using assignment history', async () => {
  const originalUser = User.findById;
  const originalAssignments = ZoomPhoneNumberAssignment.find;
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const today = new Date().toISOString().slice(0, 10);
  // Keep the test's calls away from local midnight and weekly rollover.
  const timezone = new Date().getUTCHours() < 12 ? 'Etc/GMT+12' : 'UTC';
  const before = new Date(Date.now() - 3600_000).toISOString();
  const after = new Date(Date.now() - 600_000).toISOString();
  const release = new Date(Date.now() - 1800_000);
  const assignedAt = new Date(Date.now() - 86400_000);
  const visited: string[] = [];
  try {
    process.env.ZOOM_ACCOUNT_ID = 'test-account';
    process.env.ZOOM_CLIENT_ID = 'test-client';
    process.env.ZOOM_CLIENT_SECRET = 'test-secret';
    User.findById = (() => ({ select: () => ({ lean: async () => ({ email: 'crm@example.com' }) }) })) as unknown as typeof User.findById;
    ZoomPhoneNumberAssignment.find = (() => ({ lean: async () => [
      { crmUser: 'user-a', normalizedNumber: '441234567890', zoomPhoneUserId: 'shared', assignedAt, releasedAt: release },
      { crmUser: 'user-b', normalizedNumber: '441234567890', zoomPhoneUserId: 'shared', assignedAt: release }
    ] })) as unknown as typeof ZoomPhoneNumberAssignment.find;
    globalThis.fetch = (async (input) => {
      const url = new URL(String(input));
      visited.push(url.pathname);
      if (url.pathname === '/oauth/token') return new globalThis.Response(JSON.stringify({ access_token: 'fake', expires_in: 3600 }));
      if (url.pathname === '/v2/phone/users') return new globalThis.Response(JSON.stringify({ users: [
        { id: 'shared', email: 'shared@example.com' }, { id: 'someone-else', email: 'other@example.com' }
      ] }));
      assert.equal(url.pathname, '/v2/phone/users/shared/call_history');
      assert.ok(url.searchParams.get('from')! <= today);
      const call = { call_element_id: 'own', start_time: before, direction: 'outbound', caller_did_number: '+441234567890', talk_time: 60 };
      return new globalThis.Response(JSON.stringify(url.searchParams.get('next_page_token') ? {
        call_elements: [call, { ...call, call_element_id: 'reassigned', start_time: after, talk_time: 600 }]
      } : { call_elements: [call], next_page_token: 'page-2' }));
    }) as typeof fetch;
    const result = await zoomPhoneService.getMyTalkTime('user-a', timezone);
    assert.equal(result.linked, true);
    assert.equal(result.weekly.talk_time_seconds, 60);
    assert.equal(visited.filter((path) => path.endsWith('/call_history')).length, 2);
    assert.ok(!visited.some((path) => path.includes('someone-else/call_history')));
  } finally {
    User.findById = originalUser;
    ZoomPhoneNumberAssignment.find = originalAssignments;
    globalThis.fetch = originalFetch;
    for (const key of ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET']) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
});

test('personal endpoint always uses the authenticated user and rejects invalid timezone', async () => {
  const original = zoomPhoneService.getMyTalkTime;
  let status = 0;
  let called = false;
  const response = {
    status: (value: number) => { status = value; return response; },
    json: () => response,
    setHeader: () => response
  } as unknown as Response;
  try {
    zoomPhoneService.getMyTalkTime = async (id, timezone) => {
      assert.equal(id, 'authenticated');
      assert.equal(timezone, 'Asia/Kolkata');
      called = true;
      return { linked: false, timezone, updated_at: '', daily: { date: '', talk_time_seconds: 0, connected_calls: 0 }, weekly: { from: '', to: '', talk_time_seconds: 0, connected_calls: 0 } };
    };
    await getMyZoomTalkTime({ query: { userId: 'someone-else', timezone: 'Asia/Kolkata' }, user: { userId: 'authenticated' } } as unknown as Request, response);
    assert.equal(status, 200);
    assert.equal(called, true);
    called = false;
    await getMyZoomTalkTime({ query: { timezone: 'invalid/timezone' }, user: { userId: 'authenticated' } } as unknown as Request, response);
    assert.equal(status, 400);
    assert.equal(called, false);
    await getMyZoomTalkTime({ query: {} } as Request, response);
    assert.equal(status, 401);
    zoomPhoneService.getMyTalkTime = async () => { throw Object.assign(new Error('Zoom scope error'), { statusCode: 401 }); };
    await getMyZoomTalkTime({ query: {}, user: { userId: 'authenticated' } } as unknown as Request, response);
    assert.equal(status, 502);
  } finally {
    zoomPhoneService.getMyTalkTime = original;
  }
});
