const CLASS_START_HOUR = 9;
const CLASS_END_HOUR = 18;
const SESSION_DURATION_MS = 2 * 60 * 1000;

export function isWithinClassHours(date = new Date()) {
  const d = new Date(date);
  const hour = d.getHours();
  const minute = d.getMinutes();
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
