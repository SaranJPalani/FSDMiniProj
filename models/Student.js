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
  email: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please provide a valid email address'
    }
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
