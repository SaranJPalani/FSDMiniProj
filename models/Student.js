const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  rollNo: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  // Store LBPH feature vector for face recognition
  faceVector: {
    type: [Number],
    default: null
  },
  // Track when student was registered
  registeredAt: {
    type: Date,
    default: Date.now
  },
  // Store paths to training images
  trainingImages: [{
    type: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
