const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  rollNo: String,
  name: String,
  status: {
    type: String,
    enum: ['Present', 'Absent'],
    default: 'Absent'
  },
  markedAt: {
    type: Date,
    default: null
  },
  // Session info - useful for grouping attendance by class
  sessionDate: {
    type: Date,
    default: Date.now
  },
  sessionName: {
    type: String,
    default: 'Default Session'
  },
  // Recognition confidence
  recognitionDistance: Number
}, { timestamps: true });

// Index for faster queries
attendanceSchema.index({ sessionDate: 1, student: 1 });
attendanceSchema.index({ sessionName: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
