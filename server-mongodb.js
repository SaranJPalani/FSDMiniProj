/*
  server.js - Express backend with MongoDB for attendance system
  Features:
  - Register Student: capture face data, train LBPH model, save to MongoDB
  - Take Attendance: recognize faces and mark present in current session
  - Send Attendance: email attendance sheet for current session
  - Clear Attendance: reset attendance for new class
  - Delete Students: remove student data when needed
*/

const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

// MongoDB setup
const connectDB = require('./config/database');
const Student = require('./models/Student');
const Attendance = require('./models/Attendance');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const DATA_DIR = path.join(__dirname, 'data');
const IMAGES_DIR = path.join(__dirname, 'images');
const PUBLIC_DIR = path.join(__dirname, 'public');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// Connect to MongoDB
connectDB();

// Serve static frontend
app.use(express.static(PUBLIC_DIR));
app.use('/data', express.static(DATA_DIR));

// POST /api/register - Register new student with face data
app.post('/api/register', async (req, res) => {
  try {
    const { name, rollNo, frames, features } = req.body;
    
    if (!name || !rollNo || !Array.isArray(frames) || frames.length < 25) {
      return res.status(400).json({ error: 'name, rollNo, and 25 frames are required' });
    }

    // Check if student already exists
    const existingStudent = await Student.findOne({ rollNo });
    if (existingStudent) {
      return res.status(400).json({ error: 'Student with this roll number already exists' });
    }

    // Create new student
    const student = new Student({ name, rollNo });

    // Save training images
    const imagePaths = [];
    frames.slice(0, 25).forEach((dataUrl, i) => {
      const base64 = dataUrl.split(',')[1] || '';
      const buf = Buffer.from(base64, 'base64');
      const filename = `${student._id}-${name}_${i}.jpg`;
      const filePath = path.join(IMAGES_DIR, filename);
      fs.writeFileSync(filePath, buf);
      imagePaths.push(filename);
    });
    student.trainingImages = imagePaths;

    // Train LBPH model: compute average feature vector from multi-pose training
    if (Array.isArray(features) && features.length >= 1) {
      const len = features[0]?.length || 0;
      if (len > 0) {
        const sum = new Array(len).fill(0);
        const count = features.length; // Use all frames (35 instead of 25)
        for (let i = 0; i < count; i++) {
          const f = features[i];
          for (let j = 0; j < len; j++) sum[j] += (Number(f[j]) || 0);
        }
        student.faceVector = sum.map(v => v / count);
      }
    }

    await student.save();

    res.json({ ok: true, id: student._id, message: 'Student registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/recognize - Recognize face and mark attendance
app.post('/api/recognize', async (req, res) => {
  try {
    const { feature } = req.body;
    
    if (!Array.isArray(feature) || feature.length === 0) {
      return res.status(400).json({ error: 'feature array is required' });
    }

    // Get all students with face vectors
    const students = await Student.find({ faceVector: { $exists: true, $ne: null } });
    
    if (students.length === 0) {
      return res.json({ recognized: false, name: 'No registered students' });
    }

    // Find nearest neighbor using LBPH feature vectors
    let bestStudent = null;
    let bestDist = Number.POSITIVE_INFINITY;
    
    for (const student of students) {
      if (!Array.isArray(student.faceVector)) continue;
      
      const vec = student.faceVector;
      const len = Math.min(vec.length, feature.length);
      let dist = 0;
      
      for (let i = 0; i < len; i++) {
        const d = (vec[i] || 0) - (feature[i] || 0);
        dist += d * d;
      }
      dist = Math.sqrt(dist / len); // normalized RMSE
      
      if (dist < bestDist) {
        bestDist = dist;
        bestStudent = student;
      }
    }

    // Recognition threshold (tune based on your needs)
    const THRESHOLD = 0.18;
    
    if (!bestStudent || bestDist > THRESHOLD) {
      return res.json({ recognized: false, name: 'not recognized', distance: bestDist });
    }

    // Mark attendance
    const now = new Date();
    let attendance = await Attendance.findOne({
      student: bestStudent._id,
      sessionDate: { $gte: new Date().setHours(0, 0, 0, 0) }
    });

    if (!attendance) {
      attendance = new Attendance({
        student: bestStudent._id,
        rollNo: bestStudent.rollNo,
        name: bestStudent.name,
        status: 'Present',
        markedAt: now,
        recognitionDistance: bestDist
      });
    } else {
      attendance.status = 'Present';
      attendance.markedAt = now;
      attendance.recognitionDistance = bestDist;
    }

    await attendance.save();

    res.json({
      recognized: true,
      id: bestStudent._id,
      name: bestStudent.name,
      rollNo: bestStudent.rollNo,
      distance: bestDist
    });
  } catch (error) {
    console.error('Recognition error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/send-attendance - Generate CSV and email attendance
app.post('/api/send-attendance', async (req, res) => {
  try {
    // Get today's attendance
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const attendanceRecords = await Attendance.find({
      sessionDate: { $gte: startOfDay }
    }).populate('student');

    // Get all students for complete list
    const allStudents = await Student.find({});
    
    // Create CSV
    const rows = [['ID', 'Roll No.', 'Name', 'Status', 'Date And Time']];
    
    for (const student of allStudents) {
      const record = attendanceRecords.find(r => r.student && r.student._id.equals(student._id));
      
      if (record && record.status === 'Present') {
        rows.push([
          student._id.toString(),
          student.rollNo,
          student.name,
          'Present',
          record.markedAt ? record.markedAt.toISOString().replace('T', ' ').slice(0, 19) : 'N/A'
        ]);
      } else {
        rows.push([
          student._id.toString(),
          student.rollNo,
          student.name,
          'Absent',
          'Absent'
        ]);
      }
    }

    const csv = rows.map(r => r.join(',')).join('\n');
    const attendanceCsv = path.join(DATA_DIR, 'attendanceSheet.csv');
    fs.writeFileSync(attendanceCsv, csv);

    // Send email
    const to = process.env.EMAIL_TO || 'saranjpalani@gmail.com';
    const fromUser = process.env.EMAIL_FROM || 'attendancesender007@gmail.com';
    const fromPass = process.env.EMAIL_PASSWORD || 'dsqkgbqfosxsmxpz';

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: fromUser, pass: fromPass }
    });

    await transporter.sendMail({
      from: fromUser,
      to,
      subject: `Attendance Report - ${new Date().toLocaleDateString()}`,
      html: `<p>Please find the attached attendance sheet for today's class.</p>
             <p>Total Students: ${allStudents.length}</p>
             <p>Present: ${attendanceRecords.filter(r => r.status === 'Present').length}</p>
             <p>Absent: ${allStudents.length - attendanceRecords.filter(r => r.status === 'Present').length}</p>`,
      attachments: [{ filename: 'attendanceSheet.csv', path: attendanceCsv }]
    });

    res.json({ ok: true, message: 'Attendance sent successfully' });
  } catch (error) {
    console.error('Send attendance error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/clear-attendance - Clear attendance for new class
app.post('/api/clear-attendance', async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const result = await Attendance.deleteMany({
      sessionDate: { $gte: startOfDay }
    });
    
    currentSessionId = null;
    
    res.json({ 
      ok: true, 
      message: `Cleared ${result.deletedCount} attendance records`,
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('Clear attendance error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/students/:id - Delete a student
app.delete('/api/students/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Delete training images
    student.trainingImages.forEach(filename => {
      const filePath = path.join(IMAGES_DIR, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    // Delete all attendance records for this student
    await Attendance.deleteMany({ student: student._id });

    // Delete the student
    await Student.findByIdAndDelete(req.params.id);

    res.json({ ok: true, message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/clear-all-students - Clear all student data
app.post('/api/clear-all-students', async (req, res) => {
  try {
    // Delete all attendance records
    await Attendance.deleteMany({});
    
    // Get all students to delete their images
    const students = await Student.find({});
    students.forEach(student => {
      student.trainingImages.forEach(filename => {
        const filePath = path.join(IMAGES_DIR, filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    });

    // Delete all students
    const result = await Student.deleteMany({});

    res.json({ 
      ok: true, 
      message: `Cleared ${result.deletedCount} students and all related data`,
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('Clear all students error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/students - Get all students with today's attendance
app.get('/api/students', async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const students = await Student.find({}).sort({ rollNo: 1 });
    const attendanceRecords = await Attendance.find({
      sessionDate: { $gte: startOfDay }
    });

    const items = students.map(student => {
      const attendance = attendanceRecords.find(r => r.student.equals(student._id));
      return {
        id: student._id,
        rollNo: student.rollNo,
        name: student.name,
        status: attendance?.status || 'Absent',
        time: attendance?.markedAt ? attendance.markedAt.toISOString().replace('T', ' ').slice(0, 19) : 'Absent',
        registeredAt: student.registeredAt
      };
    });

    res.json(items);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/stats - Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const todayPresent = await Attendance.countDocuments({
      sessionDate: { $gte: startOfDay },
      status: 'Present'
    });

    res.json({
      totalStudents,
      todayPresent,
      todayAbsent: totalStudents - todayPresent,
      attendancePercentage: totalStudents > 0 ? ((todayPresent / totalStudents) * 100).toFixed(1) : 0
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve the app
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
