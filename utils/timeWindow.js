const CLASS_START_HOUR = 9;
const CLASS_END_HOUR = 18;
const SESSION_DURATION_MS = 2 * 60 * 1000;

// India (Velachery/Chennai): UTC+5:30 = 330 minutes. Set ATTENDANCE_UTC_OFFSET_MINUTES if different.
const UTC_OFFSET_MINUTES = Number(process.env.ATTENDANCE_UTC_OFFSET_MINUTES) || 330;
const UTC_OFFSET_MS = UTC_OFFSET_MINUTES * 60 * 1000;

/** Get hour and minute in the configured timezone (default IST). */
function getHourMinuteInTimezone(date) {
  const d = new Date(date.getTime() + UTC_OFFSET_MS);
  return { hour: d.getUTCHours(), minute: d.getUTCMinutes() };
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
