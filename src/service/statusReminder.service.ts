import Reminder from '../models/reminder';

export const STATUS_REMINDER_TIME_ZONES = ['Europe/London', 'Asia/Kolkata'] as const;

export type StatusReminderTimeZone = typeof STATUS_REMINDER_TIME_ZONES[number];

export interface StatusReminderInput {
  date: string;
  time: string;
  timeZone: StatusReminderTimeZone;
}

type StatusReminderKind = 'status_follow_up' | 'status_call_back';

export interface ParsedStatusReminder extends StatusReminderInput {
  kind: StatusReminderKind;
  label: 'Follow-up' | 'Call Back';
  remindAt: Date;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

const normalizeStatus = (status: string) => status.toLowerCase().replace(/[^a-z0-9]/g, '');

export const getStatusReminderKind = (status: string): StatusReminderKind | null => {
  const normalized = normalizeStatus(status);
  if (normalized === 'followup') return 'status_follow_up';
  if (normalized === 'callback') return 'status_call_back';
  return null;
};

export const statusNeedsReminder = (status: string) => getStatusReminderKind(status) !== null;

const getZonedParts = (date: Date, timeZone: StatusReminderTimeZone) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second')
  };
};

export const zonedDateTimeToUtc = (date: string, time: string, timeZone: StatusReminderTimeZone) => {
  const dateMatch = DATE_PATTERN.exec(date);
  const timeMatch = TIME_PATTERN.exec(time);
  if (!dateMatch || !timeMatch) throw new Error('Choose a valid reminder date and time');

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const calendarCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    throw new Error('Choose a valid reminder date and time');
  }

  const targetWallClock = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let utcGuess = targetWallClock;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const observed = getZonedParts(new Date(utcGuess), timeZone);
    const observedWallClock = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
      0
    );
    const correction = targetWallClock - observedWallClock;
    utcGuess += correction;
    if (correction === 0) break;
  }

  const result = new Date(utcGuess);
  const confirmed = getZonedParts(result, timeZone);
  if (
    confirmed.year !== year ||
    confirmed.month !== month ||
    confirmed.day !== day ||
    confirmed.hour !== hour ||
    confirmed.minute !== minute
  ) {
    throw new Error('That local time does not exist because of a daylight-saving clock change');
  }

  return result;
};

export const parseStatusReminder = (
  status: string,
  input: StatusReminderInput | undefined,
  now = new Date()
): ParsedStatusReminder | null => {
  const kind = getStatusReminderKind(status);
  if (!kind) return null;
  if (!input || typeof input !== 'object') {
    throw new Error(`A reminder date, time, and timezone are required for ${status}`);
  }
  if (!STATUS_REMINDER_TIME_ZONES.includes(input.timeZone)) {
    throw new Error('Reminder timezone must be UK time or India Standard Time');
  }

  const remindAt = zonedDateTimeToUtc(input.date, input.time, input.timeZone);
  if (remindAt.getTime() <= now.getTime()) throw new Error('Reminder time must be in the future');

  return {
    ...input,
    kind,
    label: kind === 'status_follow_up' ? 'Follow-up' : 'Call Back',
    remindAt
  };
};

export const replaceLeadStatusReminder = async ({
  leadId,
  leadName,
  userId,
  schedule
}: {
  leadId: unknown;
  leadName: string;
  userId: unknown;
  schedule: ParsedStatusReminder | null;
}) => {
  await Reminder.deleteMany({
    lead: leadId,
    kind: { $in: ['status_follow_up', 'status_call_back'] },
    status: 'pending'
  });

  if (!schedule) return null;

  const timeBasis = schedule.timeZone === 'Europe/London' ? 'UK time' : 'India Standard Time';
  return Reminder.create({
    user: userId,
    lead: leadId,
    title: `${schedule.label}: ${leadName}`,
    note: `Scheduled for ${schedule.date} at ${schedule.time} (${timeBasis}) when the lead status changed to ${schedule.label}.`,
    remindAt: schedule.remindAt,
    status: 'pending',
    kind: schedule.kind,
    scheduledTimeZone: schedule.timeZone,
    scheduledLocalDate: schedule.date,
    scheduledLocalTime: schedule.time
  });
};
