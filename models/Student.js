import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  batch: { type: String, required: true },
  mockInterviewScore: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now }
});

// Sparse unique: only non-empty phones must be unique; avoids E11000 on null/duplicate phoneNo from legacy data
studentSchema.index({ phone: 1 }, { unique: true, sparse: true });

export default mongoose.model('Student', studentSchema);
