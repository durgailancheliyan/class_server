import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  session: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceSession', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  status: { type: String, enum: ['present', 'absent'], required: true },
  markedAt: { type: Date, default: Date.now },
  /** Normalized phone (last 10 digits) used to mark; ensures same phone cannot mark twice per session. */
  normalizedPhone: { type: String, required: false }
});

attendanceSchema.index({ session: 1, student: 1 }, { unique: true });
attendanceSchema.index({ session: 1, normalizedPhone: 1 }, { unique: true, sparse: true });

export default mongoose.model('Attendance', attendanceSchema);
