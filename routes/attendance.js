import express from 'express';
import AttendanceSession from '../models/AttendanceSession.js';
import Attendance from '../models/Attendance.js';
import Student from '../models/Student.js';
import { isSessionOpen } from '../utils/timeWindow.js';
import { isWithinVelachery, getLocationFromRequest } from '../utils/location.js';
import { getClientIp, checkProxyAllowed } from '../utils/proxyCheck.js';

const router = express.Router();

/** Normalize phone to last 10 digits for comparison (handles +91, spaces, dashes). */
function normalizePhone(value) {
  if (value == null || typeof value !== 'string') return '';
  const digits = value.replace(/\D/g, '');
  return digits.slice(-10);
}

// Rules: (1) Only the student's own registered phone can mark. (2) Phone must be in student list for this session.
// (3) Another student's phone or another device/phone cannot mark—we resolve the student only from the phone provided.
router.post('/mark/:slug', async (req, res) => {
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
    const { slug } = req.params;
    const { status, phone } = req.body;
    // Never use studentId from client – attendance is determined only by the phone number (must be the student's own registered number)
    if (!['present', 'absent'].includes(status)) {
      return res.status(400).json({ message: 'Valid status (present/absent) required.' });
    }
    const phoneTrimmed = phone != null ? String(phone).trim() : '';
    if (!phoneTrimmed) {
      return res.status(400).json({ message: 'Attendance must be marked using the student\'s own registered phone number only. Another device or another phone cannot mark for you.' });
    }
    const session = await AttendanceSession.findOne({ slug, isActive: true }).populate('course', '_id');
    if (!session) {
      return res.status(404).json({ message: 'Session not found or expired.' });
    }
    if (!isSessionOpen(session.opensAt, session.closesAt)) {
      return res.status(400).json({ message: 'Attendance window has closed. Link expired.' });
    }
    // Resolve student only by phone: must be in student list; prevents using another student's number or another device/phone
    const inputNormalized = normalizePhone(phoneTrimmed);
    if (!inputNormalized) {
      return res.status(400).json({ message: 'Enter a valid registered phone number.' });
    }
    const studentsInBatch = await Student.find({ course: session.course._id, batch: session.batch }).select('_id phone').lean();
    const match = studentsInBatch.filter(s => normalizePhone(s.phone) === inputNormalized);
    if (match.length === 0) {
      return res.status(403).json({
        message: 'This phone number is not in the student list. You cannot mark present or absent. Only your own registered phone number is allowed; using another student\'s number is not allowed.'
      });
    }
    if (match.length > 1) {
      return res.status(400).json({ message: 'Multiple students share this number. Contact admin.' });
    }
    // Mark is only for the student who owns this phone – we never allow another student's number to mark
    const studentId = match[0]._id;
    const existing = await Attendance.findOne({ session: session._id, student: studentId });
    if (existing) {
      return res.status(400).json({ message: 'You have already marked attendance for this session.' });
    }
    const attendance = await Attendance.create({
      session: session._id,
      student: studentId,
      status
    });
    res.status(201).json({
      message: 'Attendance marked successfully.',
      status: attendance.status
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
