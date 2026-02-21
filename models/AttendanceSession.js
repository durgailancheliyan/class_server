import mongoose from 'mongoose';

const attendanceSessionSchema = new mongoose.Schema({
  trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  batch: { type: String, required: true },
  sessionDate: { type: Date, required: true },
  opensAt: { type: Date, required: true },
  closesAt: { type: Date, required: true },
  slug: { type: String, required: true, unique: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

attendanceSessionSchema.index({ course: 1, batch: 1, sessionDate: 1 });

export default mongoose.model('AttendanceSession', attendanceSessionSchema);
