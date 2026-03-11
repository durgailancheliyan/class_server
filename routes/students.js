import express from 'express';
import Student from '../models/Student.js';
import AttendanceSession from '../models/AttendanceSession.js';
import Attendance from '../models/Attendance.js';
import { ensureDefaultAbsentForClosedSessions } from '../utils/attendance.js';
import { protect, adminOnly, trainerOrAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const { course, batch } = req.query;
    const filter = {};
    if (course) filter.course = course;
    if (batch) filter.batch = batch;
    const students = await Student.find(filter).populate('course', 'name code').sort({ name: 1 }).lean();
    if (students.length === 0) {
      return res.json(students);
    }
    if (course && batch) {
      const sessions = await AttendanceSession.find({ course, batch })
        .select('_id sessionDate closesAt')
        .sort({ sessionDate: -1 })
        .limit(60)
        .lean();
      const sessionIds = sessions.map((s) => s._id);
      const now = new Date();
      const closedSessions = sessions.filter((s) => new Date(s.closesAt) < now);
      await ensureDefaultAbsentForClosedSessions(closedSessions, students);
      const sessionDateMap = Object.fromEntries(sessions.map((s) => [s._id.toString(), s.sessionDate]));
      const attendances = await Attendance.find({ session: { $in: sessionIds } })
        .select('session student status')
        .lean();
      const byStudent = {};
      for (const a of attendances) {
        const sid = a.student.toString();
        const date = sessionDateMap[a.session.toString()];
        if (!date) continue;
        const dateStr = new Date(date).toISOString().slice(0, 10);
        if (!byStudent[sid]) byStudent[sid] = [];
        byStudent[sid].push({ date: dateStr, status: a.status });
      }
      students.forEach((s) => {
        s.attendanceByDate = (byStudent[s._id.toString()] || []).sort((a, b) => b.date.localeCompare(a.date));
      });
      const sessionDates = sessions.map((s) => {
        const d = new Date(s.sessionDate);
        const dateStr = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
        return { dateStr, label };
      });
      return res.json({ students, sessionDates });
    }
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('course', 'name code');
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const phone = req.body.phone != null ? String(req.body.phone).trim() : '';
    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required and must be unique.' });
    }
    const existing = await Student.findOne({ phone });
    if (existing) {
      return res.status(400).json({ message: 'Phone number already registered. Use unique phone per student.' });
    }
    const student = await Student.create({ ...req.body, phone });
    res.status(201).json(await student.populate('course', 'name code'));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Trainer or admin: update only mock interview score
router.patch('/:id/mock-score', protect, trainerOrAdmin, async (req, res) => {
  try {
    const score = req.body.mockInterviewScore;
    const update = {};
    if (score !== undefined && score !== null && score !== '') {
      const num = Number(score);
      if (Number.isNaN(num) || num < 0 || num > 100) {
        return res.status(400).json({ message: 'Mock interview score must be between 0 and 100.' });
      }
      update.mockInterviewScore = num;
    } else {
      update.mockInterviewScore = null;
    }
    const student = await Student.findByIdAndUpdate(req.params.id, update, { new: true }).populate('course', 'name code');
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    if (req.body.phone) {
      const existing = await Student.findOne({ phone: req.body.phone, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ message: 'Phone number already in use by another student.' });
      }
    }
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('course', 'name code');
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', protect, trainerOrAdmin, async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json({ message: 'Student deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/bulk-delete', protect, trainerOrAdmin, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (ids.length === 0) {
      return res.status(400).json({ message: 'Provide an array of student ids (ids).' });
    }
    const result = await Student.deleteMany({ _id: { $in: ids } });
    res.json({ message: `Deleted ${result.deletedCount} student(s).`, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
