import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Course', courseSchema);
