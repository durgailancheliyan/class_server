import express from 'express';
import Course from '../models/Course.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const courses = await Course.find().sort({ name: 1 });
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const course = await Course.create(req.body);
    res.status(201).json(course);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
