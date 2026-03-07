import express from 'express';
import AttendanceSession from '../models/AttendanceSession.js';
import Student from '../models/Student.js';
import Attendance from '../models/Attendance.js';
import { protect, trainerOrAdmin, trainerOnly } from '../middleware/auth.js';
import { isWithinClassHours, getSessionWindow } from '../utils/timeWindow.js';
import { generateSessionSlug } from '../utils/slug.js';
import { isWithinVelachery, getLocationFromRequest } from '../utils/location.js';
import { getClientIp, checkProxyAllowed } from '../utils/proxyCheck.js';

const router = express.Router();

router.post('/', protect, trainerOnly, async (req, res) => {
  try {
    if (!isWithinClassHours()) {
      return res.status(400).json({
        message: 'Attendance can only be created between 9:00 AM and 6:00 PM.'
      });
    }
    const { course, batch } = req.body;
    if (!course || !batch) {
      return res.status(400).json({ message: 'Course and batch required' });
    }
    const { opensAt, closesAt } = getSessionWindow();
    const slug = generateSessionSlug();
    const session = await AttendanceSession.create({
      trainer: req.user._id,
      course,
      batch,
      sessionDate: new Date(),
      opensAt,
      closesAt,
      slug
    });
    const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/attend/${slug}`;
    res.status(201).json({
      ...session.toObject(),
      link,
      message: 'Attendance link active for 5 minutes.'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', protect, trainerOrAdmin, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { trainer: req.user._id };
    const sessions = await AttendanceSession.find(filter)
      .populate('course', 'name code')
      .populate('trainer', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

function normalizePhone(value) {
  if (value == null || typeof value !== 'string') return '';
  return value.replace(/\D/g, '').slice(-10);
}

router.get('/:slug', async (req, res) => {
  try {
    const clientIp = getClientIp(req);
    const proxyCheck = await checkProxyAllowed(clientIp);
    if (!proxyCheck.allowed) {
      return res.status(403).json({ message: proxyCheck.reason });
    }
    const { lat, lng } = getLocationFromRequest(req);
    const locationCheck = isWithinVelachery(lat, lng);
    if (!locationCheck.allowed) {
      return res.status(403).json({
        message: locationCheck.reason || 'Attendance is only allowed at Besant Technologies, Velachery, Chennai. Please enable location and be on campus.'
      });
    }
    const session = await AttendanceSession.findOne({ slug: req.params.slug, isActive: true })
      .populate('course', 'name code');
    if (!session) {
      return res.status(404).json({ message: 'Session not found or expired.' });
    }
    const now = new Date();
    if (now < new Date(session.opensAt)) {
      return res.status(400).json({ message: 'Session not yet open.' });
    }
    if (now > new Date(session.closesAt)) {
      return res.status(400).json({ message: 'Session has closed. Link expired.' });
    }

    const phoneQuery = req.query.phone != null ? String(req.query.phone).trim() : '';
    if (phoneQuery) {
      const inputNorm = normalizePhone(phoneQuery);
      if (!inputNorm) {
        return res.status(400).json({ message: 'Enter your registered phone number.' });
      }
      const studentsInBatch = await Student.find({ course: session.course._id, batch: session.batch }).select('name phone').lean();
      const match = studentsInBatch.filter(s => normalizePhone(s.phone) === inputNorm);
      if (match.length === 0) {
        return res.status(404).json({ message: 'No student found with this phone number in this batch. Use only your own registered number. Another student\'s number is not allowed. One click—Present or Absent—one time only.' });
      }
      if (match.length > 1) {
        return res.status(400).json({ message: 'Multiple students share this number. Contact admin.' });
      }
      const markedOne = await Attendance.findOne({ session: session._id, student: match[0]._id }).select('status').lean();
      return res.json({
        session: {
          _id: session._id,
          slug: session.slug,
          course: session.course,
          batch: session.batch,
          closesAt: session.closesAt
        },
        student: {
          _id: match[0]._id,
          name: match[0].name,
          status: markedOne?.status ?? null
        }
      });
    }

    const students = await Student.find({ course: session.course._id, batch: session.batch })
      .select('name email phone');
    const marked = await Attendance.find({ session: session._id }).select('student status');
    const markedMap = Object.fromEntries(marked.map(m => [m.student.toString(), m.status]));
    const maskPhone = (p) => {
      if (!p || typeof p !== 'string') return '';
      const digits = p.replace(/\D/g, '');
      const last4 = digits.slice(-4);
      return last4 ? '******' + last4 : '';
    };
    res.json({
      session: {
        _id: session._id,
        slug: session.slug,
        course: session.course,
        batch: session.batch,
        closesAt: session.closesAt
      },
      students: students.map(s => ({
        _id: s._id,
        name: s.name,
        email: s.email,
        phoneMasked: maskPhone(s.phone),
        status: markedMap[s._id.toString()] || null
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
