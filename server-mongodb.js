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
const emailService = require('./services/emailService');

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
    const { name, rollNo, email, frames, features } = req.body;
    
    if (!name || !rollNo || !email || !Array.isArray(frames) || frames.length < 25) {
      return res.status(400).json({ error: 'name, rollNo, email, and 25 frames are required' });
    }

    // Check if student already exists
    const existingStudent = await Student.findOne({ rollNo });
    if (existingStudent) {
      return res.status(400).json({ error: 'Student with this roll number already exists' });
    }

    // Create new student
        const student = new Student({ name, rollNo, email });

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

// POST /api/recognize - Just recognize face, don't mark attendance
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

// POST /api/mark-attendance - Mark attendance with subject and timeslot
app.post('/api/mark-attendance', async (req, res) => {
  try {
    const { feature, subject, timeslot, slotType } = req.body;
    
    if (!feature || !subject || !timeslot || !slotType) {
      return res.status(400).json({ error: 'feature, subject, timeslot, and slotType are required' });
    }

    // First recognize the face
    const students = await Student.find({ faceVector: { $exists: true, $ne: null } });
    
    if (students.length === 0) {
      return res.json({ recognized: false, message: 'No registered students' });
    }

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
      dist = Math.sqrt(dist / len);
      
      if (dist < bestDist) {
        bestDist = dist;
        bestStudent = student;
      }
    }

    const THRESHOLD = 0.18;
    
    if (!bestStudent || bestDist > THRESHOLD) {
      return res.json({ recognized: false, message: 'Face not recognized', distance: bestDist });
    }

    // Mark attendance for specific subject and timeslot
    const now = new Date();
    const today = new Date().setHours(0, 0, 0, 0);
    
    let attendance = await Attendance.findOne({
      student: bestStudent._id,
      subject: subject,
      timeslot: timeslot,
      sessionDate: { $gte: today }
    });

    if (!attendance) {
      attendance = new Attendance({
        student: bestStudent._id,
        rollNo: bestStudent.rollNo,
        name: bestStudent.name,
        subject: subject,
        timeslot: timeslot,
        slotType: slotType,
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
      success: true,
      recognized: true,
      student: {
        id: bestStudent._id,
        name: bestStudent.name,
        rollNo: bestStudent.rollNo
      },
      attendance: {
        subject: subject,
        timeslot: timeslot,
        slotType: slotType,
        markedAt: now
      },
      distance: bestDist
    });
  } catch (error) {
    console.error('Attendance marking error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/send-attendance - Generate CSV and email attendance
app.post('/api/send-attendance', async (req, res) => {
  try {
    const { subject, timeslot, slotType } = req.body;
    
    if (!subject || !timeslot || !slotType) {
      return res.status(400).json({ error: 'Subject, timeslot, and slotType are required' });
    }
    
    // Get today's attendance for specific subject and timeslot
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const attendanceRecords = await Attendance.find({
      sessionDate: { $gte: startOfDay },
      subject: subject,
      timeslot: timeslot
    }).populate('student');

    // Get all students for complete list
    const allStudents = await Student.find({});
    
    // Create CSV with subject and timeslot info
    const rows = [
      [`Subject: ${subject}`],
      [`Timeslot: ${slotType.toUpperCase()} - ${timeslot}`],
      [`Date: ${new Date().toLocaleDateString()}`],
      [],
      ['Roll No.', 'Name', 'Status', 'Date And Time']
    ];
    
    for (const student of allStudents) {
      const record = attendanceRecords.find(r => r.student && r.student._id.equals(student._id));
      
      if (record && record.status === 'Present') {
        rows.push([
          student.rollNo,
          student.name,
          'Present',
          record.markedAt ? record.markedAt.toISOString().replace('T', ' ').slice(0, 19) : 'N/A'
        ]);
      } else {
        rows.push([
          student.rollNo,
          student.name,
          'Absent',
          'Absent'
        ]);
      }
    }

    const csv = rows.map(r => r.join(',')).join('\n');
    
    // Create filename with subject and timeslot
    const safeSubject = subject.replace(/[^a-zA-Z0-9]/g, '_');
    const safeTimeslot = timeslot.replace(/[^a-zA-Z0-9]/g, '-');
    const filename = `${safeSubject}_${slotType}_${safeTimeslot}_${new Date().toISOString().split('T')[0]}.csv`;
    const attendanceCsv = path.join(DATA_DIR, filename);
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
      subject: `Attendance Report - ${subject} (${slotType.toUpperCase()}) - ${timeslot} - ${new Date().toLocaleDateString()}`,
      html: `<p>Please find the attached attendance sheet for:</p>
             <p><strong>Subject:</strong> ${subject}</p>
             <p><strong>Timeslot:</strong> ${slotType.toUpperCase()} - ${timeslot}</p>
             <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
             <br>
             <p><strong>Summary:</strong></p>
             <p>Total Students: ${allStudents.length}</p>
             <p>Present: ${attendanceRecords.filter(r => r.status === 'Present').length}</p>
             <p>Absent: ${allStudents.length - attendanceRecords.filter(r => r.status === 'Present').length}</p>`,
      attachments: [{ filename: filename, path: attendanceCsv }]
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
        email: student.email, // Include email
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

// PUT /api/students/:id - Update student details
app.put('/api/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, rollNo, email } = req.body;

    // Validate input
    if (!name || !rollNo || !email) {
      return res.status(400).json({ error: 'Name, roll number, and phone number are required' });
    }

    // Check if roll number is already taken by another student
    const existingStudent = await Student.findOne({ 
      rollNo, 
      _id: { $ne: id } // Exclude current student from check
    });
    
    if (existingStudent) {
      return res.status(400).json({ error: 'Roll number already exists for another student' });
    }

    // Update student
    const updatedStudent = await Student.findByIdAndUpdate(
      id,
      { name, rollNo, email },
      { new: true, runValidators: true }
    );

    if (!updatedStudent) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({ 
      success: true, 
      message: 'Student updated successfully',
      student: {
        id: updatedStudent._id,
        name: updatedStudent.name,
        rollNo: updatedStudent.rollNo,
        email: updatedStudent.email
      }
    });

  } catch (error) {
    console.error('Update student error:', error);
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

// POST /api/clear-database - Clear all data (students and attendance)
app.post('/api/clear-database', async (req, res) => {
  try {
    // Clear all students and attendance records
    await Student.deleteMany({});
    await Attendance.deleteMany({});
    
    console.log('🗑️ Database cleared successfully');
    res.json({ success: true, message: 'Database cleared successfully' });
  } catch (error) {
    console.error('Error clearing database:', error);
    res.status(500).json({ error: 'Failed to clear database' });
  }
});

// GET /api/database-stats - Get database statistics
app.get('/api/database-stats', async (req, res) => {
  try {
    const studentCount = await Student.countDocuments();
    const attendanceCount = await Attendance.countDocuments();
    
    res.json({
      students: studentCount,
      attendanceRecords: attendanceCount,
      collections: ['students', 'attendances']
    });
  } catch (error) {
    console.error('Error getting database stats:', error);
    res.status(500).json({ error: 'Failed to get database stats' });
  }
});
// POST /api/send-absent-notifications - Send email notifications to absent students
app.post('/api/send-absent-notifications', async (req, res) => {
  try {
    const { subject, timeslot, slotType } = req.body;
    
    if (!subject || !timeslot || !slotType) {
      return res.status(400).json({ error: 'Subject, timeslot, and slotType are required' });
    }

    // Get today's attendance for specific subject and timeslot
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const attendanceRecords = await Attendance.find({
      sessionDate: { $gte: startOfDay },
      subject: subject,
      timeslot: timeslot
    }).populate('student');

    // Get all students
    const allStudents = await Student.find({});
    
    // Find absent students (students without attendance record or marked absent)
    const absentStudents = allStudents.filter(student => {
      const record = attendanceRecords.find(r => r.student && r.student._id.equals(student._id));
      return !record || record.status === 'Absent';
    });

    if (absentStudents.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No absent students found. All students are present!',
        sentCount: 0 
      });
    }

    // Filter students with valid email addresses
    const studentsWithEmails = absentStudents.filter(student => 
      student.email && student.email.includes('@')
    );

    if (studentsWithEmails.length === 0) {
      return res.json({ 
        success: false, 
        message: 'No absent students have valid email addresses.',
        absentCount: absentStudents.length,
        sentCount: 0 
      });
    }

    const results = [];

    // Send email to each absent student
    for (const student of studentsWithEmails) {
      const result = await emailService.sendAbsenceNotification(
        student.email,
        student.name,
        subject,
        timeslot
      );
      
      results.push({
        student: student.name,
        rollNo: student.rollNo,
        email: student.email,
        success: result.success,
        error: result.error
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.length - successCount;

    res.json({
      success: true,
      message: `Email notifications sent to absent students`,
      absentCount: absentStudents.length,
      sentCount: successCount,
      failedCount: failedCount,
      subject: subject,
      timeslot: timeslot,
      results: results
    });

  } catch (error) {
    console.error('Email notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/test-email - Test email functionality
app.post('/api/test-email', async (req, res) => {
  try {
    const { email, message } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const testMessage = message || 'Test email from FSD Attendance System. Your email service is working correctly!';
    
    const result = await emailService.sendTestEmail(email, testMessage);
    
    res.json({
      success: result.success,
      message: result.success ? 'Test email sent successfully!' : 'Test email failed',
      error: result.error,
      email: result.email
    });

  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
