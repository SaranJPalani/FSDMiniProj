# 🎓 Face Recognition Attendance System

Web-based attendance system with MongoDB and multi-pose LBPH face recognition.

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
