import express from 'express';
import Student from '../models/Student.js';
import { protect, adminOnly } from '../middleware/auth.js';

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

export default router;
