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
  // Subject and timeslot information
  subject: {
    type: String,
    required: true
  },
  timeslot: {
    type: String,
    required: true
  },
  slotType: {
    type: String,
    enum: ['theory', 'lab'],
    required: true
  },
  // Session info - useful for grouping attendance by class
  sessionDate: {
    type: Date,
    default: Date.now
  },
  sessionName: {
    type: String,
    default: function() {
      return `${this.subject}_${this.slotType}_${this.timeslot}`;
    }
  },
  // Recognition confidence
  recognitionDistance: Number
}, { timestamps: true });

// Index for faster queries
attendanceSchema.index({ sessionDate: 1, student: 1 });
attendanceSchema.index({ sessionName: 1 });
attendanceSchema.index({ subject: 1, timeslot: 1, sessionDate: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
