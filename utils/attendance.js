import Attendance from '../models/Attendance.js';
import Student from '../models/Student.js';

/**
 * For closed sessions (closesAt < now), create absent records for any student
 * in that session's course+batch who did not mark attendance.
 * @param {Array} closedSessions - Sessions with _id, course, batch
 * @param {Array} [studentsPreFetched] - If all closedSessions share same course+batch, pass student list to avoid extra queries
 */
export async function ensureDefaultAbsentForClosedSessions(closedSessions, studentsPreFetched = null) {
  if (closedSessions.length === 0) return;
  const sessionIds = closedSessions.map((s) => s._id);
  const existing = await Attendance.find({ session: { $in: sessionIds } })
    .select('session student')
    .lean();
  const existingSet = new Set(existing.map((a) => `${a.session}_${a.student}`));
  const toInsert = [];
  const studentsToUse = studentsPreFetched && closedSessions.length > 0
    ? studentsPreFetched
    : null;
  for (const session of closedSessions) {
    const students = studentsToUse ?? await Student.find({ course: session.course, batch: session.batch }).select('_id').lean();
    for (const student of students) {
      const id = `${session._id}_${student._id}`;
      if (!existingSet.has(id)) {
        toInsert.push({ session: session._id, student: student._id, status: 'absent' });
        existingSet.add(id);
      }
    }
  }
  if (toInsert.length > 0) await Attendance.insertMany(toInsert);
}
