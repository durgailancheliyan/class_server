import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceSession', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  status: { type: String, enum: ['present', 'absent'], required: true },
  markedAt: { type: Date, default: Date.now }
});

attendanceSchema.index({ session: 1, student: 1 }, { unique: true });

export default mongoose.model('Attendance', attendanceSchema);
