import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Course from './models/Course.js';
import Student from './models/Student.js';

import authRoutes from './routes/auth.js';
import coursesRoutes from './routes/courses.js';
import studentsRoutes from './routes/students.js';
import attendanceSessionsRoutes from './routes/attendanceSessions.js';
import attendanceRoutes from './routes/attendance.js';
import reportsRoutes from './routes/reports.js';
import excelRoutes from './routes/excel.js';

await connectDB();

// Remove legacy phoneNo index if present (fixes E11000 dup key: { phoneNo: null })
try {
  await Student.collection.dropIndex('phoneNo_1');
  console.log('Dropped legacy index students.phoneNo_1');
} catch (e) {
  if (e.code !== 27 && e.codeName !== 'IndexNotFound') console.warn('Index drop:', e.message);
}

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/sessions', attendanceSessionsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/excel', excelRoutes);

// Production: serve frontend build (when running from repo root, e.g. Render)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDistFromBackend = path.resolve(__dirname, '../frontend/dist');
const frontendDistFromRoot = path.join(process.cwd(), 'frontend', 'dist');
if (process.env.NODE_ENV === 'production') {
  const servePath = fs.existsSync(frontendDistFromRoot) ? frontendDistFromRoot : frontendDistFromBackend;
  if (fs.existsSync(servePath)) {
    app.use(express.static(servePath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(servePath, 'index.html'));
    });
  }
}

async function seedInitial() {
  const adminPassword = await bcrypt.hash('admin123', 10);
  const trainerPassword = await bcrypt.hash('trainer123', 10);
  await User.findOneAndUpdate(
    { email: /^admin@besant\.com$/i },
    { $set: { name: 'Admin', email: 'admin@besant.com', password: adminPassword, role: 'admin' } },
    { upsert: true, new: true }
  );
  await User.findOneAndUpdate(
    { email: /^trainer@besant\.com$/i },
    { $set: { name: 'Trainer', email: 'trainer@besant.com', password: trainerPassword, role: 'trainer' } },
    { upsert: true, new: true }
  );
  console.log('Admin & Trainer ready: admin@besant.com / admin123, trainer@besant.com / trainer123');
  const courseCount = await Course.countDocuments();
  if (courseCount === 0) {
    await Course.insertMany([
      { name: 'SQL', code: 'SQL' },
      { name: 'Frontend Development', code: 'FRONTEND' },
      { name: 'MERN Stack', code: 'MERN' },
      { name: '.NET', code: 'DOTNET' }
    ]);
    console.log('Default courses created: SQL, Frontend, MERN, .NET');
  }
}
await seedInitial();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
