# 🎓 Face Recognition Attendance System

Modern web-based attendance system using face recognition with MongoDB integration and email notifications.

## ✨ Key Features

### 🎯 **Core Functionality**
- **Multi-Pose Student Registration**: 35-frame training with guided poses for better accuracy
- **Real-Time Face Recognition**: 3-frame detection system with live visual feedback
- **Subject & Timeslot Management**: Complete academic scheduling with theory/lab sessions
- **Email Notifications**: Professional HTML emails for absent student alerts
- **Excel Reports**: Clean attendance sheets without database IDs
- **Student Management**: Add, edit, delete students with email validation

### 📊 **Smart Detection System**
- **Frame-Based Recognition**: Requires 3 consecutive frames for stable detection
- **Visual Feedback**: Color-coded rectangles with status labels
  - 🔵 **Blue** - Registration mode (consistent during student registration)
  - 🟡 **Yellow** - Detection mode (collecting frames)
  - 🟢 **Green** - Recognized student
  - 🔴 **Red** - Unknown person
- **LBPH Algorithm**: Local Binary Pattern Histogram for robust face recognition
- **Multi-Pose Training**: 6 different poses (straight, left, right, up, down, smile)

### 📧 **Email Integration**
- **Absence Notifications**: Automated emails to absent students
- **Professional Templates**: HTML-formatted emails with attendance details
- **Test Functionality**: Built-in email testing to verify service
- **Excel Attachments**: Clean attendance reports via email

## 🚀 Quick Start

### Prerequisites
```bash
✅ Node.js 18+ installed
✅ MongoDB running (MongoDB Compass recommended)
✅ Webcam for face capture
✅ Gmail account for email notifications
```

### Installation
```powershell
# 1. Install dependencies
npm install

# 2. Configure environment
# Copy .env.example to .env and configure your email

# 3. Start MongoDB (via MongoDB Compass)
# Connect to mongodb://localhost:27017

# 4. Run the application
npm start

# 5. Open browser
# Navigate to http://localhost:3000
```

## 📋 How to Use

### 1. **Register Students**
- Enter name, roll number, and email address
- Follow multi-pose training instructions (35 frames total)
- System guides through 6 different poses for optimal recognition

### 2. **Take Attendance**
- Select subject from dropdown
- Choose appropriate timeslot (theory/lab sessions)
- Students stand in front of camera for recognition
- 🔵 Blue box = registration mode, 🟡 Yellow = detecting, 🟢 Green = recognized, 🔴 Red = unknown

### 3. **Send Notifications**
- Click "📧 Email Absent Students" to notify absent students
- Click "Send Attendance" to email Excel reports
- Clean reports without database IDs

## ⚙️ Configuration

### Email Setup (Required)
Create `.env` file with:
```env
EMAIL_FROM=your-gmail@gmail.com
EMAIL_PASSWORD=your-app-password  # 16-character Gmail App Password
EMAIL_TO=reports@school.com
MONGODB_URI=mongodb://localhost:27017/attendance_system
PORT=3000
```

**Gmail App Password Setup:**
1. Enable 2-Factor Authentication
2. Visit: https://myaccount.google.com/apppasswords
3. Generate App Password for "Mail"
4. Use 16-character password in .env file

## 📁 Project Structure

```
📦 Face Recognition Attendance System
├── 🌐 public/                    # Frontend assets
│   ├── index.html                # Main interface
│   ├── script.js                 # Face detection logic
│   └── style.css                 # UI styling
├── 🗄️ models/                    # Database schemas
│   ├── Student.js                # Student data model
│   └── Attendance.js             # Attendance records
├── 📧 services/                  # Email functionality
│   └── emailService.js           # Email notifications
├── ⚙️ config/                    # Configuration
│   └── database.js               # MongoDB connection
├── 📊 data/                      # Runtime data
│   └── haarcascade_frontalface_default.xml
├── 🖼️ images/                    # Training images
├── 🚀 server-mongodb.js          # Main server
└── 📝 .env                       # Environment config
```

## 🎨 Interface Features

### **Academic Management**
- **8 Subjects**: Mathematics, Physics, Chemistry, Biology, Computer Science, English, History, Geography
- **Theory Sessions**: 4 time slots (8:10-9:00, 9:00-9:50, 11:00-11:50, etc.)
- **Lab Sessions**: 3 extended slots (8:10-11:50, 11:50-2:00, 2:00-3:40)
- **Visual Timetable**: Interactive grid for easy timeslot selection

### **Real-Time Feedback**
- **Detection Status**: Live frame counter and recognition status
- **Color Coding**: 
  - 🔵 Blue (registration mode) → 🟡 Yellow (detecting) → 🟢 Green (recognized) / 🔴 Red (unknown)
  - Consistent blue rectangle during student registration process
- **Student Display**: Privacy-protected email display (username@***)

## 🔧 Technology Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Computer Vision** | OpenCV.js, Haar Cascade |
| **Face Recognition** | LBPH (Local Binary Pattern Histogram) |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB with Mongoose ODM |
| **Email Service** | Nodemailer with Gmail SMTP |
| **File Processing** | CSV generation for Excel reports |

## 📊 Database Schema

### Students Collection
```javascript
{
  name: String,           // Student name
  rollNo: String,         // Unique roll number
  email: String,          // Email for notifications
  faceVector: [Number],   // LBPH feature vector
  trainingImages: [String], // Image file paths
  registeredAt: Date      // Registration timestamp
}
```

### Attendance Collection
```javascript
{
  student: ObjectId,      // Reference to student
  subject: String,        // Subject name
  timeslot: String,       // Time slot
  slotType: String,       // 'theory' or 'lab'
  status: String,         // 'Present' or 'Absent'
  sessionDate: Date,      // Attendance date
  markedAt: Date         // Recognition timestamp
}
```

## 🔒 Security & Privacy

- ✅ **Local Processing**: All face recognition runs locally
- ✅ **Secure Email**: App passwords instead of main credentials
- ✅ **Privacy Protection**: Email addresses displayed as username@***
- ✅ **Environment Variables**: Sensitive data in .env (gitignored)
- ✅ **MongoDB Local**: Database runs locally by default

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| **MongoDB Connection Failed** | Start MongoDB Compass, verify connection to localhost:27017 |
| **Camera Not Working** | Check browser permissions, close other camera apps |
| **Email Not Sending** | Verify Gmail App Password, check spam folder |
| **Face Not Detected** | Ensure good lighting, face camera directly |
| **Recognition Errors** | Re-register student with better lighting |

## 🚀 Performance Tips

- **Optimal Lighting**: Well-lit environment for better detection
- **Camera Quality**: Higher resolution improves recognition accuracy
- **Re-registration**: Update face data after significant appearance changes
- **Browser**: Chrome/Edge recommended for best OpenCV.js performance

## 📈 Future Enhancements

- 🔮 **Deep Learning**: Upgrade to FaceNet/ArcFace for better accuracy
- 📱 **Mobile App**: React Native companion app
- 📊 **Analytics Dashboard**: Attendance trends and insights
- 🔄 **Batch Processing**: Bulk student import from CSV
- 🌐 **Multi-Campus**: Support for multiple locations

---

**🎯 Built for modern educational institutions requiring automated, accurate attendance tracking with professional communication standards.**

## ✨ Features

### Core Features:
- **Register Student**: Multi-pose training (35 frames) with guided instructions
  - Captures 6 different poses: straight, left, right, up, down, smile
  - Better accuracy with varied angles and expressions
- **Take Attendance**: Real-time face recognition
  - 🟢 Green box + name when recognized
  - 🔴 Red box when not recognized
  - Continuous recognition display
- **Send Attendance**: Email CSV report
- **Clear Attendance**: Start new class session
- **Delete Students**: Individual or bulk delete
- **Statistics**: View attendance rates

## 🚀 Quick Start

### Prerequisites:
1. **Node.js 18+** installed
2. **MongoDB** running (via MongoDB Compass)
3. **Webcam** for face capture

### Installation:

```powershell
# 1. Install dependencies
npm install

# 2. Make sure MongoDB is running
# Open MongoDB Compass - connect to localhost:27017

# 3. Configure email (optional, for sending reports)
# Edit .env file with your Gmail details

# 4. Start server
npm start

# 5. Open http://localhost:3000
```

### How to Use:

**Register Students (Multi-Pose Training):**
1. Enter name and roll number
2. Click "Register Student"
3. Follow on-screen instructions:
   - Look straight (8 frames)
   - Turn left (6 frames)
   - Turn right (6 frames)
   - Look up (5 frames)
   - Look down (4 frames)
   - Smile (6 frames)
4. Total: 35 frames in ~20 seconds

**Take Attendance:**
- Recognized faces show GREEN box + name
- Unknown faces show RED box
- Click "Take Attendance" to mark present

**Send Reports:**
- Click "Send Attendance" to email CSV

## 📧 Email Configuration

Create a `.env` file:

```env
EMAIL_FROM=your-gmail@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
EMAIL_TO=recipient@email.com
MONGODB_URI=mongodb://localhost:27017/attendance_system
PORT=3000
```

**Important:** Use Gmail App Password, not your regular password!
- See `EMAIL_SETUP.md` for step-by-step instructions
- Generate App Password: https://myaccount.google.com/apppasswords

## 📁 Project Structure

```
fsdfinalgrounds/
├── public/                  # Frontend files
│   ├── index.html          # Main UI
│   ├── script.js           # Face detection & recognition
│   └── style.css           # Styling
├── models/                  # MongoDB schemas
│   ├── Student.js          # Student data model
│   ├── Attendance.js       # Attendance records
│   └── Session.js          # Class sessions
├── config/
│   └── database.js         # MongoDB connection
├── data/                    # Generated files
│   ├── attendanceSheet.csv # Email attachment
│   └── haarcascade_frontalface_default.xml
├── images/                  # Training face images
├── server-mongodb.js       # Main server (MongoDB version)
├── server.js               # Legacy server (CSV version)
└── .env                    # Configuration (create from .env.example)
```

## 🎨 UI Features

- **6 Action Buttons:**
  - Register Student (Green)
  - Take Attendance (Blue)
  - Send Attendance (Red)
  - Clear Attendance (Orange) - New class session
  - Clear All Students (Dark Red) - Delete everything
  - Show Stats (Purple) - Attendance statistics

- **Live Camera Feed:**
  - Real-time face detection
  - Color-coded recognition feedback
  - Name labels for recognized faces

- **Student List:**
  - Shows all registered students
  - Live attendance status
  - Delete individual students

## 🔧 Technology Stack

- **Frontend:** HTML5, CSS3, JavaScript, OpenCV.js
- **Backend:** Node.js, Express
- **Database:** MongoDB (via Mongoose)
- **Face Recognition:** LBPH (Local Binary Patterns Histogram)
- **Face Detection:** Haar Cascade (OpenCV)
- **Email:** Nodemailer (SMTP)

## 📚 Documentation

- `EMAIL_SETUP.md` - Email configuration guide

## 🔐 Security Notes

- Keep `.env` file private (already in `.gitignore`)
- Use Gmail App Passwords (not your main password)
- Enable 2-Factor Authentication on Gmail
- MongoDB runs locally (no external access by default)

## � Multi-Pose Training Benefits

- Better recognition accuracy (~15-20% improvement)
- Works with different head angles
- Handles varied expressions
- More robust to lighting changes
- Recommended: re-register after major haircut

## 🐛 Troubleshooting

**MongoDB won't connect?**
- Check MongoDB Compass shows "Connected"
- Verify `MONGODB_URI` in `.env`

**Camera not working?**
- Allow camera permissions in browser
- Close other apps using camera

**Email not sending?**
- Check `EMAIL_SETUP.md`
- Verify App Password is correct (16 chars)
- Check spam folder

**Face not detected?**
- Ensure good lighting
- Face camera directly
- Wait for red box to appear

## 📊 MongoDB Collections

View in MongoDB Compass (`localhost:27017/attendance_system`):

- **students** - Registered students with LBPH face vectors
- **attendances** - Attendance records with timestamps

## 🚀 Future Improvements

- Deep learning models (FaceNet/DeepFace) for better accuracy
- Multiple classes per day
- Historical reports and analytics
- Mobile app

---

**Built with ❤️ for automated attendance tracking**
