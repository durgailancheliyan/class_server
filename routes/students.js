import express from 'express';
import Student from '../models/Student.js';
import { protect, adminOnly, trainerOrAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const { course, batch } = req.query;
    const filter = {};
    if (course) filter.course = course;
    if (batch) filter.batch = batch;
    const students = await Student.find(filter).populate('course', 'name code').sort({ name: 1 });
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

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json({ message: 'Student deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/bulk-delete', protect, adminOnly, async (req, res) => {
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
