const CLASS_START_HOUR = 9;
const CLASS_END_HOUR = 18;
const SESSION_DURATION_MS = 2 * 60 * 1000;

// Use India time so 9–6 check works for Velachery/Chennai (set ATTENDANCE_TIMEZONE if needed)
const TIMEZONE = process.env.ATTENDANCE_TIMEZONE || 'Asia/Kolkata';

function getHourMinuteInTimezone(date) {
  try {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: TIMEZONE,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const hourPart = parts.find((p) => p.type === 'hour');
    const minutePart = parts.find((p) => p.type === 'minute');
    if (hourPart && minutePart) {
      return {
        hour: parseInt(hourPart.value, 10),
        minute: parseInt(minutePart.value, 10)
      };
    }
  } catch (e) {
    console.warn('timeWindow: using server local time', e.message);
  }
  return { hour: date.getHours(), minute: date.getMinutes() };
}

export function isWithinClassHours(date = new Date()) {
  const { hour, minute } = getHourMinuteInTimezone(date);
  const totalMinutes = hour * 60 + minute;
  const startMinutes = CLASS_START_HOUR * 60;
  const endMinutes = CLASS_END_HOUR * 60;
  return totalMinutes >= startMinutes && totalMinutes < endMinutes;
}

export function getSessionWindow() {
  const now = new Date();
  const opensAt = new Date(now);
  const closesAt = new Date(now.getTime() + SESSION_DURATION_MS);
  return { opensAt, closesAt };
}

export function isSessionOpen(opensAt, closesAt) {
  const now = new Date();
  return now >= new Date(opensAt) && now <= new Date(closesAt);
}

export { SESSION_DURATION_MS };
