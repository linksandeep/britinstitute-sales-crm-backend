type QueryValue = string | undefined;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const firstValue = (value: unknown): QueryValue => {
  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0]) : undefined;
  }

  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return String(value);
};

const parseOffset = (value: unknown) => {
  const rawOffset = firstValue(value);
  if (!rawOffset) return 0;

  const offset = Number(rawOffset);
  return Number.isFinite(offset) ? offset : 0;
};

const parseDateBoundary = (
  value: unknown,
  boundary: 'start' | 'end',
  timezoneOffsetMinutes: number
) => {
  const rawDate = firstValue(value);
  if (!rawDate) return undefined;

  if (DATE_ONLY_PATTERN.test(rawDate)) {
    const [year, month, day] = rawDate.split('-').map(Number);
    const utcHour = boundary === 'start' ? 0 : 23;
    const utcMinute = boundary === 'start' ? 0 : 59;
    const utcSecond = boundary === 'start' ? 0 : 59;
    const utcMs = boundary === 'start' ? 0 : 999;
    const timestamp =
      Date.UTC(year, month - 1, day, utcHour, utcMinute, utcSecond, utcMs) +
      timezoneOffsetMinutes * 60_000;

    return new Date(timestamp);
  }

  const parsed = new Date(rawDate);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const getLeadDateFilter = (query: Record<string, unknown>) => {
  const dateField = firstValue(query.dateField) === 'updatedAt' ? 'updatedAt' : 'createdAt';
  const timezoneOffsetMinutes = parseOffset(query.timezoneOffsetMinutes);
  const exactDate = firstValue(query.date);

  const start = exactDate
    ? parseDateBoundary(exactDate, 'start', timezoneOffsetMinutes)
    : parseDateBoundary(query.fromDate, 'start', timezoneOffsetMinutes);
  const end = exactDate
    ? parseDateBoundary(exactDate, 'end', timezoneOffsetMinutes)
    : parseDateBoundary(query.toDate, 'end', timezoneOffsetMinutes);

  if (!start && !end) {
    return {};
  }

  const range: Record<string, Date> = {};
  if (start) range.$gte = start;
  if (end) range.$lte = end;

  return { [dateField]: range };
};

export const applyLeadDateFilter = (filter: Record<string, unknown>, query: Record<string, unknown>) => {
  Object.assign(filter, getLeadDateFilter(query));
};
