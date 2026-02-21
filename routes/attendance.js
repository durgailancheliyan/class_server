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
    const { studentId, status, phone } = req.body;
    if (!studentId || !['present', 'absent'].includes(status)) {
      return res.status(400).json({ message: 'Valid studentId and status (present/absent) required.' });
    }
    const phoneTrimmed = phone != null ? String(phone).trim() : '';
    if (!phoneTrimmed) {
      return res.status(400).json({ message: 'Phone number is required to mark attendance.' });
    }
    const session = await AttendanceSession.findOne({ slug, isActive: true }).populate('course', '_id');
    if (!session) {
      return res.status(404).json({ message: 'Session not found or expired.' });
    }
    if (!isSessionOpen(session.opensAt, session.closesAt)) {
      return res.status(400).json({ message: 'Attendance window has closed. Link expired.' });
    }
    const student = await Student.findOne({
      _id: studentId,
      course: session.course._id,
      batch: session.batch
    }).select('phone');
    if (!student) {
      return res.status(400).json({ message: 'Student not found in this session.' });
    }
    const inputNormalized = normalizePhone(phoneTrimmed);
    const registeredNormalized = normalizePhone(student.phone);
    if (!inputNormalized || !registeredNormalized || inputNormalized !== registeredNormalized) {
      return res.status(403).json({
        message: 'Phone number does not match the registered number for this student.'
      });
    }
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
