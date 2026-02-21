import express from 'express';
import Attendance from '../models/Attendance.js';
import AttendanceSession from '../models/AttendanceSession.js';
import Student from '../models/Student.js';
import Course from '../models/Course.js';
import { protect, trainerOrAdmin } from '../middleware/auth.js';

const router = express.Router();

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function getMonthKey(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// Student grid: course/batch filter, month-wise present/absent, mock score (trainer or admin)
router.get('/students-grid', protect, trainerOrAdmin, async (req, res) => {
  try {
    const { course: courseId, batch, year } = req.query;
    const yearNum = year ? parseInt(year, 10) : new Date().getFullYear();
    if (!courseId || !batch) {
      return res.status(400).json({ message: 'Course and batch are required.' });
    }
    const sessionMatch = { course: courseId, batch, sessionDate: { $gte: new Date(`${yearNum}-01-01`), $lte: endOfDay(new Date(`${yearNum}-12-31`)) } };
    if (req.user.role === 'trainer') sessionMatch.trainer = req.user._id;
    const sessions = await AttendanceSession.find(sessionMatch).select('_id sessionDate').lean();
    const sessionIds = sessions.map((s) => s._id);
    const sessionDateMap = Object.fromEntries(sessions.map((s) => [s._id.toString(), s.sessionDate]));
    const students = await Student.find({ course: courseId, batch }).select('name email phone mockInterviewScore').sort({ name: 1 }).lean();
    const attendances = await Attendance.find({ session: { $in: sessionIds } }).select('session student status').lean();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const byStudentMonth = {};
    for (const a of attendances) {
      const sid = a.student.toString();
      const date = sessionDateMap[a.session.toString()];
      if (!date) continue;
      const key = getMonthKey(date);
      if (!byStudentMonth[sid]) byStudentMonth[sid] = {};
      if (!byStudentMonth[sid][key]) byStudentMonth[sid][key] = { present: 0, absent: 0 };
      if (a.status === 'present') byStudentMonth[sid][key].present += 1;
      else byStudentMonth[sid][key].absent += 1;
    }
    const months = [];
    for (let m = 1; m <= 12; m++) {
      months.push({ key: `${yearNum}-${String(m).padStart(2, '0')}`, label: monthNames[m - 1] });
    }
    const grid = students.map((s) => {
      const sid = s._id.toString();
      const byMonth = byStudentMonth[sid] || {};
      const attendanceByMonth = months.map(({ key, label }) => ({
        month: key,
        label,
        present: byMonth[key]?.present ?? 0,
        absent: byMonth[key]?.absent ?? 0
      }));
      return {
        _id: s._id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        mockInterviewScore: s.mockInterviewScore ?? null,
        attendanceByMonth
      };
    });
    res.json({ year: yearNum, months, students: grid });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/daily', protect, trainerOrAdmin, async (req, res) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const start = startOfDay(date);
    const end = endOfDay(date);
    const filter = { createdAt: { $gte: start, $lte: end } };
    if (req.user.role === 'trainer') filter.trainer = req.user._id;
    const sessions = await AttendanceSession.find(filter)
      .populate('course', 'name code')
      .populate('trainer', 'name');
    const sessionIds = sessions.map(s => s._id);
    const attendances = await Attendance.find({ session: { $in: sessionIds } })
      .populate('student', 'name email phone')
      .populate('session', 'course batch');
    res.json({ date, sessions, attendances });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/analytics', protect, trainerOrAdmin, async (req, res) => {
  try {
    const { courseId, batch, from, to } = req.query;
    const match = {};
    if (courseId) match.course = courseId;
    if (batch) match.batch = batch;
    if (from || to) {
      match.sessionDate = {};
      if (from) match.sessionDate.$gte = new Date(from);
      if (to) match.sessionDate.$lte = endOfDay(to);
    }
    if (req.user.role === 'trainer') match.trainer = req.user._id;
    const sessions = await AttendanceSession.find(match).select('_id');
    const sessionIds = sessions.map(s => s._id);
    const agg = await Attendance.aggregate([
      { $match: { session: { $in: sessionIds } } },
      { $group: { _id: '$student', present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } }, total: { $sum: 1 } } },
      { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'student' } },
      { $unwind: '$student' },
      { $lookup: { from: 'courses', localField: 'student.course', foreignField: '_id', as: 'course' } },
      { $unwind: { path: '$course', preserveNullAndEmptyArrays: true } },
      { $project: { name: '$student.name', email: '$student.email', phone: '$student.phone', batch: '$student.batch', course: '$course.name', present: 1, total: 1, percentage: { $multiply: [{ $cond: [{ $eq: ['$total', 0] }, 0, { $divide: ['$present', '$total'] }] }, 100] } } }
    ]);
    res.json(agg);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/export', protect, trainerOrAdmin, async (req, res) => {
  try {
    const { from, to, courseId } = req.query;
    const match = {};
    if (from) match.sessionDate = { ...match.sessionDate, $gte: new Date(from) };
    if (to) match.sessionDate = { ...match.sessionDate, $lte: endOfDay(to) };
    if (courseId) match.course = courseId;
    if (req.user.role === 'trainer') match.trainer = req.user._id;
    const sessions = await AttendanceSession.find(match)
      .populate('course', 'name code')
      .sort({ sessionDate: 1 });
    const attendances = await Attendance.find({ session: { $in: sessions.map(s => s._id) } })
      .populate('student', 'name email phone')
      .populate('session');
    res.json({ sessions, attendances });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
