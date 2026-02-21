import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import Student from '../models/Student.js';
import Attendance from '../models/Attendance.js';
import AttendanceSession from '../models/AttendanceSession.js';
import Course from '../models/Course.js';
import { protect, adminOnly, trainerOrAdmin } from '../middleware/auth.js';

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// Download sample Excel template for student upload (admin only)
router.get('/template/students', protect, adminOnly, async (req, res) => {
  try {
    const sample = [
      { Name: 'Student One', Email: 'one@example.com', Phone: '9876543210', Course: 'SQL', Batch: 'Batch 1' },
      { Name: 'Student Two', Email: 'two@example.com', Phone: '9876543211', Course: 'MERN Stack', Batch: 'Batch 1' }
    ];
    const ws = xlsx.utils.json_to_sheet(sample);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Students');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=student-upload-template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/import/students', protect, adminOnly, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Excel file required' });
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);
    const courses = await Course.find();
    const courseByName = Object.fromEntries(courses.map(c => [c.name.toLowerCase(), c._id]));
    const courseByCode = Object.fromEntries(courses.map(c => [c.code.toLowerCase(), c._id]));
    const added = [];
    const skipped = [];
    for (const row of rows) {
      const name = row['Name'] ?? row['name'] ?? row['Student Name'];
      const email = row['Email'] ?? row['email'] ?? '';
      const phone = String(row['Phone'] ?? row['phone'] ?? row['Contact'] ?? '').trim();
      const courseName = (row['Course'] ?? row['course'] ?? '').toString().trim();
      const batch = String(row['Batch'] ?? row['batch'] ?? '').trim();
      if (!name || !phone) {
        skipped.push({ row, reason: 'Missing name or phone' });
        continue;
      }
      const courseId = courseByName[courseName.toLowerCase()] ?? courseByCode[courseName.toLowerCase()] ?? courses[0]?._id;
      if (!courseId) {
        skipped.push({ row, reason: 'Course not found' });
        continue;
      }
      const exists = await Student.findOne({ phone });
      if (exists) {
        skipped.push({ row, reason: 'Duplicate phone number' });
        continue;
      }
      const student = await Student.create({ name, email: email || `${phone}@student.local`, phone, course: courseId, batch: batch || 'Default' });
      added.push(student);
    }
    res.json({ message: `Imported ${added.length} students`, added: added.length, skipped: skipped.length, skippedDetails: skipped });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/export/attendance', protect, trainerOrAdmin, async (req, res) => {
  try {
    const { from, to, courseId } = req.query;
    const match = {};
    if (from) match.sessionDate = { ...match.sessionDate, $gte: new Date(from) };
    if (to) match.sessionDate = { ...match.sessionDate, $lte: new Date(to) };
    if (courseId) match.course = courseId;
    if (req.user.role === 'trainer') match.trainer = req.user._id;
    const sessions = await AttendanceSession.find(match).populate('course', 'name code').sort({ sessionDate: 1 });
    const attendances = await Attendance.find({ session: { $in: sessions.map(s => s._id) } })
      .populate('student', 'name email phone')
      .populate('session');
    const data = attendances.map(a => ({
      Date: a.session?.sessionDate ? new Date(a.session.sessionDate).toLocaleDateString() : '',
      Course: a.session?.course?.name ?? '',
      Batch: a.session?.batch ?? '',
      Student: a.student?.name ?? '',
      Email: a.student?.email ?? '',
      Phone: a.student?.phone ?? '',
      Status: a.status
    }));
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data.length ? data : [{ Date: '', Course: '', Batch: '', Student: '', Email: '', Phone: '', Status: 'No records' }]);
    xlsx.utils.book_append_sheet(wb, ws, 'Attendance');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=attendance-export.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
