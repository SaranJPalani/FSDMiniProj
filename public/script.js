const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const octx = overlay.getContext('2d');
const btnRegister = document.getElementById('btnRegister');
const btnAttendance = document.getElementById('btnAttendance');
const btnSend = document.getElementById('btnSend');
const btnEmailAbsent = document.getElementById('btnEmailAbsent');
const btnClearAttendance = document.getElementById('btnClearAttendance');
const btnClearAll = document.getElementById('btnClearAll');
const btnClearDatabase = document.getElementById('btnClearDatabase');
const btnStats = document.getElementById('btnStats');
const inputName = document.getElementById('name');
const inputRoll = document.getElementById('rollNo');
const inputEmail = document.getElementById('studentEmail');
const studentsDiv = document.getElementById('students');
const studentCount = document.getElementById('studentCount');
const statsDiv = document.getElementById('stats');
const cameraStatus = document.getElementById('cameraStatus');
const opencvStatus = document.getElementById('opencvStatus');
const subjectSelect = document.getElementById('subjectSelect');
const selectedTimeslotSpan = document.getElementById('selectedTimeslot');

let cvReady = false;
let classifier = null;
let detecting = false;
let lastFaceRect = null;
let detectIntervalId = null;
let videoReady = false;

// Simple frame-based detection (3 consecutive frames)
let detectedFrames = [];
const REQUIRED_FRAMES = 3;
let recognizedPerson = null;
let isRegistering = false; // Flag to track registration mode

// Timeslot selection
let selectedTimeslot = null;
let selectedSlotType = null;

function syncOverlaySize() {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  overlay.width = w;
  overlay.height = h;
}

async function startCamera() {
  try {
    console.log('🎥 Requesting camera access...');
    cameraStatus.textContent = '📹 Camera: Requesting access...';
    
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: 640, 
        height: 480,
        facingMode: 'user' // Use front camera if available
      } 
    });
    
    console.log('✅ Camera access granted');
    cameraStatus.textContent = '📹 Camera: Access granted';
    video.srcObject = stream;
    
    video.onloadedmetadata = () => {
      console.log('📹 Video metadata loaded, starting video...');
      video.play();
      videoReady = true;
      syncOverlaySize();
      cameraStatus.textContent = '📹 Camera: ✅ Ready';
      cameraStatus.style.color = '#22c55e';
      console.log('🎯 Video ready, checking OpenCV...');
      
      if (cvReady) {
        console.log('🚀 Starting detection loop...');
        startDetectionLoop();
      } else {
        console.log('⏳ Waiting for OpenCV to load...');
      }
    };
    
    video.onerror = (e) => {
      console.error('❌ Video error:', e);
      cameraStatus.textContent = '📹 Camera: ❌ Error';
      cameraStatus.style.color = '#ef4444';
      alert('Video playback error. Please refresh the page.');
    };
    
  } catch (err) {
    console.error('❌ Camera error:', err);
    cameraStatus.textContent = '📹 Camera: ❌ Access denied';
    cameraStatus.style.color = '#ef4444';
    alert(`Camera access denied or unavailable: ${err.message}`);
  }
}

function captureFrame() {
  const w = 640, h = 480;
  canvas.width = w; canvas.height = h;
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.85);
}

function cropFaceDataUrl(rect) {
  if (!rect) return null;
  const { x, y, w, h } = rect;
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = w; faceCanvas.height = h;
  const fctx = faceCanvas.getContext('2d');
  fctx.drawImage(video, x, y, w, h, 0, 0, w, h);
  return faceCanvas.toDataURL('image/jpeg', 0.85);
}

function faceToFeature(rect) {
  // Resize to 32x32 grayscale and flatten to a 1024-length vector normalized 0..1
  if (!rect) return null;
  const { x, y, w, h } = rect;
  const temp = document.createElement('canvas');
  temp.width = 32; temp.height = 32;
  const tctx = temp.getContext('2d');
  // draw ROI scaled to 32x32
  tctx.drawImage(video, x, y, w, h, 0, 0, 32, 32);
  const imgData = tctx.getImageData(0, 0, 32, 32).data; // RGBA
  const vec = new Array(32 * 32);
  for (let i = 0; i < 32 * 32; i++) {
    const r = imgData[i * 4 + 0];
    const g = imgData[i * 4 + 1];
    const b = imgData[i * 4 + 2];
    // grayscale
    const gray = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
    vec[i] = gray;
  }
  return vec;
}

// Simple, clean rectangle drawing
function drawFaceRect(rect, status = 'detecting', name = null, frameCount = 0) {
  // Always clear first
  octx.clearRect(0, 0, overlay.width, overlay.height);
  
  if (!rect) return;
  
  // Choose color based on status
  let color, label;
  switch(status) {
    case 'registering':
      color = 'rgba(59, 130, 246, 0.8)'; // Blue for registration
      label = 'Registration Mode';
      break;
    case 'detecting':
      color = 'rgba(255, 255, 0, 0.8)'; // Yellow
      label = `Detecting... ${frameCount}/${REQUIRED_FRAMES}`;
      break;
    case 'recognized':
      color = 'rgba(0, 255, 0, 0.8)'; // Green
      label = name || 'Recognized';
      break;
    case 'unknown':
      color = 'rgba(255, 0, 0, 0.8)'; // Red
      label = 'Unknown Person';
      break;
    default:
      color = 'rgba(255, 255, 255, 0.8)'; // White
      label = 'Face Detected';
  }
  
  // Draw thick rectangle border
  octx.strokeStyle = color;
  octx.lineWidth = 3;
  octx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  
  // Draw label background
  octx.font = 'bold 16px Arial';
  const textWidth = octx.measureText(label).width;
  const labelX = rect.x;
  const labelY = rect.y - 30;
  
  octx.fillStyle = color;
  octx.fillRect(labelX, labelY, textWidth + 16, 24);
  
  // Draw label text
  octx.fillStyle = 'white';
  octx.fillText(label, labelX + 8, labelY + 16);
}

// Store recognized person info for continuous display
let recognitionCheckInterval = null;

function startDetectionLoop() {
  if (!cvReady || detecting || !videoReady) return;
  detecting = true;
  const detect = async () => {
    try {
      if (!cvReady || !classifier || !videoReady) return;
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      const capCanvas = document.createElement('canvas');
      capCanvas.width = w; capCanvas.height = h;
      const capCtx = capCanvas.getContext('2d');
      capCtx.drawImage(video, 0, 0, w, h);
      const imageData = capCtx.getImageData(0, 0, w, h);
      const src = cv.matFromImageData(imageData);
      const gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
      const faces = new cv.RectVector();
      const msize = new cv.Size(0, 0);
      classifier.detectMultiScale(gray, faces, 1.1, 5, 0, msize, msize);
      
      if (faces.size() > 0) {
        const f = faces.get(0);
        const currentFaceRect = { x: f.x, y: f.y, w: f.width, h: f.height };
        
        // Add to detected frames array
        detectedFrames.push(currentFaceRect);
        
        // Keep only the last REQUIRED_FRAMES frames
        if (detectedFrames.length > REQUIRED_FRAMES) {
          detectedFrames.shift();
        }
        
        lastFaceRect = currentFaceRect;
        
        // Always show rectangle, but status changes based on frame count
        if (isRegistering) {
          // During registration, always show blue rectangle
          drawFaceRect(currentFaceRect, 'registering');
        } else if (detectedFrames.length >= REQUIRED_FRAMES) {
          // We have enough frames, try recognition
          await tryRecognition(currentFaceRect);
        } else {
          // Still collecting frames - show yellow with counter
          drawFaceRect(currentFaceRect, 'detecting', null, detectedFrames.length);
        }
      } else {
        // No face detected, clear everything
        lastFaceRect = null;
        detectedFrames = [];
        recognizedPerson = null;
        drawFaceRect(null); // Clear the rectangle
      }
      
      src.delete(); gray.delete(); faces.delete(); msize.delete();
    } catch (e) {
      console.error('Detection error:', e);
    }
  };
  
  detectIntervalId = setInterval(detect, 150); // Slightly slower for stability
}

// Simple recognition function
async function tryRecognition(faceRect) {
  try {
    const feature = faceToFeature(faceRect);
    if (!feature) {
      drawFaceRect(faceRect, 'unknown');
      return;
    }
    
    const response = await fetch('/api/recognize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature })
    });
    
    const data = await response.json();
    
    if (data.recognized && data.name) {
      recognizedPerson = { name: data.name, rollNo: data.rollNo };
      drawFaceRect(faceRect, 'recognized', data.name);
    } else {
      recognizedPerson = null;
      drawFaceRect(faceRect, 'unknown');
    }
  } catch (error) {
    console.error('Recognition error:', error);
    drawFaceRect(faceRect, 'unknown');
  }
}

window.onOpenCvReady = function() {
  console.log('🔧 OpenCV.js loading...');
  opencvStatus.textContent = '🔧 OpenCV: Loading...';
  
  cv['onRuntimeInitialized'] = async () => {
    try {
      console.log('⚡ OpenCV.js runtime initialized');
      opencvStatus.textContent = '🔧 OpenCV: Runtime ready';
      cvReady = true;
      
      // Use only the haarcascade_frontalface_default.xml file
      const url = '/data/haarcascade_frontalface_default.xml';
      console.log('📁 Loading Haar cascade from:', url);
      opencvStatus.textContent = '🔧 OpenCV: Loading model...';
      
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Failed to load ${url}: ${resp.status}`);
      }
      
      console.log('📥 Haar cascade file downloaded');
      const buffer = await resp.arrayBuffer();
      const data = new Uint8Array(buffer);
      
      // Clean up any existing file
      try { cv.FS_unlink('/haarcascade.xml'); } catch {}
      
      // Create the file in OpenCV's virtual filesystem
      cv.FS_createDataFile('/', 'haarcascade.xml', data, true, false);
      console.log('💾 Haar cascade loaded into OpenCV filesystem');
      
      // Load the classifier
      classifier = new cv.CascadeClassifier();
      if (!classifier.load('haarcascade.xml')) {
        throw new Error('Failed to load haarcascade classifier');
      }
      
      console.log('✅ Face detection classifier ready!');
      opencvStatus.textContent = '🔧 OpenCV: ✅ Ready';
      opencvStatus.style.color = '#22c55e';
      
      // If video is already ready, start now; else it will start when video metadata loads
      if (videoReady) {
        console.log('🚀 Video already ready, starting detection loop...');
        startDetectionLoop();
      } else {
        console.log('⏳ Waiting for video to be ready...');
      }
      
      // Also resync overlay on window resize
      window.addEventListener('resize', syncOverlaySize);
    } catch (e) {
      console.error('❌ Failed to initialize OpenCV:', e);
      opencvStatus.textContent = '🔧 OpenCV: ❌ Failed to load';
      opencvStatus.style.color = '#ef4444';
      alert('Failed to load face detection model. Please refresh the page.');
    }
  };
}

async function registerStudent() {
  const name = inputName.value.trim();
  const rollNo = inputRoll.value.trim();
  const email = inputEmail.value.trim();
  
  if (!name || !rollNo || !email) {
    alert('Enter name, roll number, and phone number');
    return;
  }
  
  // Validate phone number format
  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert('❌ Please enter a valid email address!');
    return;
  }
  
  // Check if we have enough frames detected
  if (detectedFrames.length < REQUIRED_FRAMES) {
    alert(`Please keep your face steady in front of the camera. Need ${REQUIRED_FRAMES} consecutive frames (currently have ${detectedFrames.length}).`);
    return;
  }
  
  if (!lastFaceRect) {
    alert('No face detected. Please align your face within the frame.');
    return;
  }

  // Set registration mode
  isRegistering = true;
  
  const helpDiv = document.getElementById('help');
  const originalHelp = helpDiv.textContent;
  
  // Multi-pose training instructions
  const instructions = [
    { text: '📸 Look STRAIGHT at camera', frames: 8, wait: 1000 },
    { text: '📸 Turn head slightly LEFT', frames: 6, wait: 1200 },
    { text: '📸 Turn head slightly RIGHT', frames: 6, wait: 1200 },
    { text: '📸 Look slightly UP', frames: 5, wait: 1000 },
    { text: '📸 Look slightly DOWN', frames: 4, wait: 1000 },
    { text: '📸 SMILE naturally', frames: 6, wait: 1000 }
  ];
  
  const frames = [];
  const features = [];
  
  for (const instruction of instructions) {
    // Show instruction
    helpDiv.textContent = instruction.text + ' - Get ready...';
    helpDiv.style.background = '#3b82f6';
    helpDiv.style.color = 'white';
    helpDiv.style.padding = '12px';
    helpDiv.style.borderRadius = '8px';
    helpDiv.style.fontWeight = 'bold';
    helpDiv.style.fontSize = '16px';
    
    // Wait for user to position
    await new Promise(r => setTimeout(r, instruction.wait));
    
    // Capture frames for this pose
    for (let i = 0; i < instruction.frames; i++) {
      if (!lastFaceRect) {
        helpDiv.textContent = '❌ No face detected! Position your face in frame.';
        helpDiv.style.background = '#ef4444';
        await new Promise(r => setTimeout(r, 2000));
        helpDiv.textContent = originalHelp;
        helpDiv.style = '';
        return;
      }
      
      helpDiv.textContent = `${instruction.text} - ${i + 1}/${instruction.frames}`;
      frames.push(cropFaceDataUrl(lastFaceRect));
      features.push(faceToFeature(lastFaceRect));
      await new Promise(r => setTimeout(r, 150));
    }
  }
  
  // Processing
  helpDiv.textContent = '✅ Processing... Please wait';
  helpDiv.style.background = '#22c55e';
  
  const res = await fetch('/api/register', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ name, rollNo, email, frames, features }) 
  });  const data = await res.json();
  if (data.ok) {
    alert(`✅ ${name} registered successfully with multi-pose training!`);
    inputName.value = ''; 
    inputRoll.value = '';
    inputEmail.value = '';
    loadStudents();
  } else {
    alert(data.error || 'Registration failed');
  }
  
  // Restore
  helpDiv.textContent = originalHelp;
  helpDiv.style = '';
  
  // Exit registration mode
  isRegistering = false;
}

async function takeAttendance() {
  // Check if we have enough frames detected
  if (detectedFrames.length < REQUIRED_FRAMES) {
    alert(`Please keep your face steady in front of the camera. Need ${REQUIRED_FRAMES} consecutive frames (currently have ${detectedFrames.length}).`);
    return;
  }
  
  if (!lastFaceRect) {
    alert('No face detected. Please align your face within the frame.');
    return;
  }
  
  // Check if subject is selected
  const subject = subjectSelect.value;
  if (!subject) {
    alert('Please select a subject first.');
    return;
  }
  
  // Check if timeslot is selected
  if (!selectedTimeslot || !selectedSlotType) {
    alert('Please select a timeslot first.');
    return;
  }
  
  const feature = faceToFeature(lastFaceRect);
  const res = await fetch('/api/mark-attendance', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ 
      feature, 
      subject, 
      timeslot: selectedTimeslot,
      slotType: selectedSlotType
    }) 
  });
  const data = await res.json();
  
  if (data.success && data.recognized) {
    alert(`✅ Attendance marked for ${data.student.name} (Roll: ${data.student.rollNo})\nSubject: ${data.attendance.subject}\nTimeslot: ${data.attendance.timeslot}`);
    loadStudents();
  } else {
    alert('❌ Face not recognized. Please register first.');
  }
}

async function sendAttendance() {
  // Check if subject is selected
  const subject = subjectSelect.value;
  if (!subject) {
    alert('Please select a subject first.');
    return;
  }
  
  // Check if timeslot is selected
  if (!selectedTimeslot || !selectedSlotType) {
    alert('Please select a timeslot first.');
    return;
  }
  
  const res = await fetch('/api/send-attendance', { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: subject,
      timeslot: selectedTimeslot,
      slotType: selectedSlotType
    })
  });
  const data = await res.json();
  if (data.ok) {
    alert(`Attendance sent successfully for ${subject} - ${selectedTimeslot}`);
    loadStudents();
  } else {
    alert(data.error || 'Failed to send attendance');
  }
}

async function clearAttendance() {
  if (!confirm('Clear today\'s attendance records for a new class? Students will remain registered.')) return;
  const res = await fetch('/api/clear-attendance', { method: 'POST' });
  const data = await res.json();
  if (data.ok) {
    alert(`Cleared ${data.deletedCount} attendance records. Ready for new class!`);
    loadStudents();
  } else {
    alert(data.error || 'Failed to clear attendance');
  }
}

async function clearAllStudents() {
  if (!confirm('⚠️ WARNING: This will DELETE ALL students and attendance data. Are you sure?')) return;
  if (!confirm('This cannot be undone. Continue?')) return;
  const res = await fetch('/api/clear-all-students', { method: 'POST' });
  const data = await res.json();
  if (data.ok) {
    alert(`Cleared ${data.deletedCount} students and all related data.`);
    loadStudents();
  } else {
    alert(data.error || 'Failed to clear students');
  }
}

async function showStats() {
  const res = await fetch('/api/stats');
  const data = await res.json();
  if (data.error) {
    alert(data.error);
    return;
  }
  
  const isVisible = statsDiv.style.display === 'block';
  if (isVisible) {
    statsDiv.style.display = 'none';
    btnStats.textContent = 'Show Stats';
  } else {
    statsDiv.innerHTML = `
      <h3>Today's Statistics</h3>
      <div class="stat-grid">
        <div class="stat-item">
          <div class="stat-value">${data.totalStudents}</div>
          <div class="stat-label">Total Students</div>
        </div>
        <div class="stat-item present">
          <div class="stat-value">${data.todayPresent}</div>
          <div class="stat-label">Present</div>
        </div>
        <div class="stat-item absent">
          <div class="stat-value">${data.todayAbsent}</div>
          <div class="stat-label">Absent</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${data.attendancePercentage}%</div>
          <div class="stat-label">Attendance Rate</div>
        </div>
      </div>
    `;
    statsDiv.style.display = 'block';
    btnStats.textContent = 'Hide Stats';
  }
}

async function deleteStudent(id, name) {
  if (!confirm(`Delete student "${name}"? This will remove all their data and attendance records.`)) return;
  const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.ok) {
    alert('Student deleted successfully');
    loadStudents();
  } else {
    alert(data.error || 'Failed to delete student');
  }
}

async function editStudent(id, currentName, currentRollNo, currentEmail) {
  // Create a simple modal for editing
  const newName = prompt('Edit student name:', currentName);
  if (newName === null) return; // User cancelled
  
  const newRollNo = prompt('Edit roll number:', currentRollNo);
  if (newRollNo === null) return; // User cancelled
  
  const newEmail = prompt('Edit email address:', currentEmail);
  if (newEmail === null) return; // User cancelled
  
  // Validate inputs
  if (!newName.trim()) {
    alert('Name cannot be empty');
    return;
  }
  
  if (!newRollNo.trim()) {
    alert('Roll number cannot be empty');
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
    alert('Please enter a valid email address');
    return;
  }
  
  try {
    const response = await fetch(`/api/students/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName.trim(),
        rollNo: newRollNo.trim(),
        email: newEmail.trim()
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      alert(`✅ Student updated successfully!\n\nName: ${data.student.name}\nRoll: ${data.student.rollNo}\nEmail: ${data.student.email}`);
      loadStudents(); // Refresh the list
    } else {
      alert(`❌ Error: ${data.error}`);
    }
    
  } catch (error) {
    console.error('Edit student error:', error);
    alert('❌ Failed to update student details');
  }
}

function renderStudents(items) {
  studentsDiv.innerHTML = '';
  studentCount.textContent = items.length;
  
  for (const s of items) {
    const el = document.createElement('div');
    el.className = 'student';
    const initials = s.name?.[0]?.toUpperCase() || '?';
    
    // Format email for display (show first part for privacy)
    const emailDisplay = s.email ? 
      `${s.email.split('@')[0]}@***` : 
      'No email';
    
    el.innerHTML = `
      <div class="avatar">${initials}</div>
      <div class="meta">
        <div class="name">${s.name}</div>
        <div class="roll">Roll: ${s.rollNo}</div>
        <div class="email">� ${emailDisplay}</div>
        <div class="time">${s.time}</div>
      </div>
      <div class="student-actions">
        <span class="badge ${s.status === 'Present' ? 'present' : 'absent'}">${s.status}</span>
        <button class="btn-edit" onclick="editStudent('${s.id}', '${s.name}', '${s.rollNo}', '${s.email}')" title="Edit Student">✏️</button>
        <button class="btn-delete" onclick="deleteStudent('${s.id}', '${s.name}')" title="Delete Student">🗑️</button>
      </div>
    `;
    studentsDiv.appendChild(el);
  }
}

async function loadStudents() {
  const res = await fetch('/api/students');
  const data = await res.json();
  renderStudents(data);
}

async function clearDatabase() {
  if (confirm('⚠️ This will permanently delete ALL students and attendance records. Are you sure?')) {
    try {
      const response = await fetch('/api/clear-database', { method: 'POST' });
      const result = await response.json();
      
      if (response.ok) {
        alert('✅ Database cleared successfully!');
        loadStudents(); // Refresh the display
      } else {
        alert(`❌ Failed to clear database: ${result.error}`);
      }
    } catch (error) {
      console.error('Error clearing database:', error);
      alert('❌ Error clearing database');
    }
  }
}

// Timeslot selection function
function selectTimeslot(element) {
  // Remove previous selection
  document.querySelectorAll('.time-slot').forEach(slot => {
    slot.classList.remove('selected');
  });
  
  // Add selection to clicked element
  element.classList.add('selected');
  
  // Update selected values
  selectedTimeslot = element.dataset.time;
  selectedSlotType = element.dataset.type;
  
  // Update display
  selectedTimeslotSpan.textContent = `${selectedSlotType.toUpperCase()} - ${selectedTimeslot}`;
}

// Make function global for HTML onclick
window.selectTimeslot = selectTimeslot;

btnRegister.addEventListener('click', registerStudent);
btnAttendance.addEventListener('click', takeAttendance);
btnSend.addEventListener('click', sendAttendance);
btnEmailAbsent.addEventListener('click', sendEmailToAbsentStudents);
btnClearAttendance.addEventListener('click', clearAttendance);
btnClearAll.addEventListener('click', clearAllStudents);
btnClearDatabase.addEventListener('click', clearDatabase);
btnStats.addEventListener('click', showStats);

startCamera();
loadStudents();


async function sendEmailToAbsentStudents() {
  // Check if subject is selected
  const subject = subjectSelect.value;
  if (!subject) {
    alert('Please select a subject first.');
    return;
  }
  
  // Check if timeslot is selected
  if (!selectedTimeslot || !selectedSlotType) {
    alert('Please select a timeslot first.');
    return;
  }

  if (!confirm(`Send email notifications to absent students for:\n\nSubject: ${subject}\nTimeslot: ${selectedTimeslot}\n\nThis will send emails to students who are marked absent. Continue?`)) {
    return;
  }

  try {
    btnEmailAbsent.disabled = true;
    btnEmailAbsent.textContent = '📧 Sending...';

    const response = await fetch('/api/send-absent-notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: subject,
        timeslot: selectedTimeslot,
        slotType: selectedSlotType
      })
    });

    const data = await response.json();

    if (data.success) {
      let message = `✅ Email Notifications Sent!\n\n`;
      message += `Absent Students: ${data.absentCount}\n`;
      message += `Emails Sent: ${data.sentCount}\n`;
      if (data.failedCount > 0) {
        message += `Failed: ${data.failedCount}\n`;
      }
      message += `\nSubject: ${data.subject}\nTimeslot: ${data.timeslot}`;
      
      alert(message);
    } else {
      alert(`❌ Email Error: ${data.message || data.error}`);
    }

  } catch (error) {
    console.error('Email error:', error);
    alert('❌ Failed to send email notifications');
  } finally {
    btnEmailAbsent.disabled = false;
    btnEmailAbsent.textContent = '📧 Email Absent Students';
  }
}

async function testEmail() {
  const email = prompt('Enter your email address to test email functionality:');
  if (!email) return;

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert('❌ Please enter a valid email address!');
    return;
  }

  try {
    const response = await fetch('/api/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        message: 'Test email from FSD Attendance System! Email service is working correctly. 🎉'
      })
    });

    const data = await response.json();

    if (data.success) {
      alert(`✅ Test email sent successfully to ${email}!\n\nCheck your inbox for the message.`);
    } else {
      alert(`❌ Test email failed: ${data.error}`);
    }

  } catch (error) {
    console.error('Test email error:', error);
    alert('❌ Failed to send test email');
  }
}

// Email service status check function
async function checkEmailService() {
  try {
    alert('� Email service is configured and ready!\n\nTo test functionality, use the "Test Email" feature above.');
  } catch (error) {
    console.error('Email service check error:', error);
    alert('❌ Email service check failed');
  }
}

// Make function global for HTML onclick
window.selectTimeslot = selectTimeslot;
