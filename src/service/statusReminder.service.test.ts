import assert from 'node:assert/strict';
import test from 'node:test';
import { parseStatusReminder, statusNeedsReminder, zonedDateTimeToUtc } from './statusReminder.service';

test('recognizes Follow-up and Call Back status variants', () => {
  assert.equal(statusNeedsReminder('Follow-up'), true);
  assert.equal(statusNeedsReminder('follow up'), true);
  assert.equal(statusNeedsReminder('Callback'), true);
  assert.equal(statusNeedsReminder('Call Back'), true);
  assert.equal(statusNeedsReminder('Contacted'), false);
});

test('converts UK and India wall-clock times to the correct UTC instant', () => {
  assert.equal(
    zonedDateTimeToUtc('2026-09-27', '17:00', 'Europe/London').toISOString(),
    '2026-09-27T16:00:00.000Z'
  );
  assert.equal(
    zonedDateTimeToUtc('2026-09-27', '17:00', 'Asia/Kolkata').toISOString(),
    '2026-09-27T11:30:00.000Z'
  );
  assert.equal(
    zonedDateTimeToUtc('2026-12-27', '17:00', 'Europe/London').toISOString(),
    '2026-12-27T17:00:00.000Z'
  );
});

test('requires a future schedule for reminder statuses', () => {
  assert.throws(
    () => parseStatusReminder('Follow-up', undefined, new Date('2026-01-01T00:00:00Z')),
    /required/
  );
  assert.throws(
    () => parseStatusReminder('Call Back', {
      date: '2026-09-27',
      time: '17:00',
      timeZone: 'Europe/London'
    }, new Date('2026-09-28T00:00:00Z')),
    /future/
  );
  assert.equal(parseStatusReminder('Qualified', undefined), null);
});
