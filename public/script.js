const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const octx = overlay.getContext('2d');
const btnRegister = document.getElementById('btnRegister');
const btnAttendance = document.getElementById('btnAttendance');
const btnSend = document.getElementById('btnSend');
const btnClearAttendance = document.getElementById('btnClearAttendance');
const btnClearAll = document.getElementById('btnClearAll');
const btnStats = document.getElementById('btnStats');
const inputName = document.getElementById('name');
const inputRoll = document.getElementById('rollNo');
const studentsDiv = document.getElementById('students');
const studentCount = document.getElementById('studentCount');
const statsDiv = document.getElementById('stats');

console.log('DOM elements:', { video, canvas, overlay, octx });
console.log('Overlay dimensions:', overlay.width, overlay.height);

let cvReady = false;
let classifier = null;
let detecting = false;
let lastFaceRect = null; // {x,y,w,h}
let detectIntervalId = null;
let videoReady = false;

function syncOverlaySize() {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  overlay.width = w;
  overlay.height = h;
  console.log('Overlay synced to:', w, 'x', h);
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      videoReady = true;
      syncOverlaySize();
      
      // Test: Draw a test rectangle to verify canvas is working
      setTimeout(() => {
        console.log('Drawing test rectangle...');
        octx.strokeStyle = 'yellow';
        octx.lineWidth = 5;
        octx.strokeRect(50, 50, 200, 200);
        console.log('Test rectangle drawn at 50,50,200,200');
      }, 2000);
      
      if (cvReady) startDetectionLoop();
    };
  } catch (err) {
    alert('Camera access denied or unavailable.');
    console.error(err);
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

function drawRect(rect, color = 'rgba(255, 0, 0, 0.8)', name = null) {
  console.log('drawRect called with:', { rect, color, name });
  octx.clearRect(0, 0, overlay.width, overlay.height);
  if (!rect) {
    console.log('No rect to draw, cleared canvas');
    return;
  }
  
  console.log('Drawing rectangle:', rect, 'with color:', color);
  
  // Draw rectangle
  octx.strokeStyle = color;
  octx.lineWidth = 3;
  octx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  
  console.log('Rectangle drawn successfully');
  
  // Draw name label if provided
  if (name) {
    const padding = 8;
    const fontSize = 18;
    octx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
    const textWidth = octx.measureText(name).width;
    
    // Draw background for text
    const labelHeight = fontSize + padding * 2;
    const labelY = rect.y - labelHeight - 5;
    octx.fillStyle = color;
    octx.fillRect(rect.x, labelY, textWidth + padding * 2, labelHeight);
    
    // Draw text
    octx.fillStyle = 'white';
    octx.textBaseline = 'middle';
    octx.fillText(name, rect.x + padding, labelY + labelHeight / 2);
    
    console.log('Name label drawn:', name);
  }
}

// Store recognized person info for continuous display
let recognizedPerson = null;
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
      
      console.log(`Faces detected: ${faces.size()}`);
      
      if (faces.size() > 0) {
        const f = faces.get(0);
        lastFaceRect = { x: f.x, y: f.y, w: f.width, h: f.height };
        console.log('Face rect:', lastFaceRect);
        
        // Continuously try to recognize the face
        await checkAndDisplayRecognition();
      } else {
        lastFaceRect = null;
        recognizedPerson = null;
        drawRect(null);
      }
      src.delete(); gray.delete(); faces.delete(); msize.delete();
    } catch (e) {
      // ignore transient errors
    }
  };
  detectIntervalId = setInterval(detect, 120);
}

// Continuously check if current face is recognized
async function checkAndDisplayRecognition() {
  if (!lastFaceRect) {
    console.log('No face rect available');
    drawRect(null);
    return;
  }
  
  console.log('Checking recognition for face at:', lastFaceRect);
  octx.clearRect(0, 0, overlay.width, overlay.height);
  
  try {
    const feature = faceToFeature(lastFaceRect);
    console.log('Feature extracted, calling API...');
    const res = await fetch('/api/recognize', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ feature }) 
    });
    const data = await res.json();
    console.log('Recognition result:', data);
    
    if (data.recognized) {
      // Green box with name for recognized person
      recognizedPerson = data.name;
      console.log('Drawing GREEN box for:', data.name);
      drawRect(lastFaceRect, 'rgba(0, 255, 0, 0.9)', data.name);
    } else {
      // Red box for unrecognized
      recognizedPerson = null;
      console.log('Drawing RED box - not recognized');
      drawRect(lastFaceRect, 'rgba(255, 0, 0, 0.8)');
    }
  } catch (e) {
    console.error('Recognition error:', e);
    // If recognition fails, just show red box
    drawRect(lastFaceRect, 'rgba(255, 0, 0, 0.8)');
  }
}

window.onOpenCvReady = function() {
  cv['onRuntimeInitialized'] = async () => {
    try {
      cvReady = true;
      console.log('OpenCV initialized, loading haarcascade...');
      
      // Use only the haarcascade_frontalface_default.xml file
      const url = '/data/haarcascade_frontalface_default.xml';
      
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Failed to load ${url}: ${resp.status}`);
      }
      
      const buffer = await resp.arrayBuffer();
      const data = new Uint8Array(buffer);
      
      // Clean up any existing file
      try { cv.FS_unlink('/haarcascade.xml'); } catch {}
      
      // Create the file in OpenCV's virtual filesystem
      cv.FS_createDataFile('/', 'haarcascade.xml', data, true, false);
      
      // Load the classifier
      classifier = new cv.CascadeClassifier();
      if (!classifier.load('haarcascade.xml')) {
        throw new Error('Failed to load haarcascade classifier');
      }
      
      console.log('✅ Haarcascade loaded successfully:', url);
      
      // If video is already ready, start now; else it will start when video metadata loads
      if (videoReady) {
        console.log('Video ready, starting detection loop');
        startDetectionLoop();
      }
      
      // Also resync overlay on window resize
      window.addEventListener('resize', syncOverlaySize);
    } catch (e) {
      console.error('❌ Failed to initialize OpenCV:', e);
      alert('Failed to load face detection model. Please refresh the page.');
    }
  };
}

async function registerStudent() {
  const name = inputName.value.trim();
  const rollNo = inputRoll.value.trim();
  if (!name || !rollNo) {
    alert('Enter name and roll number');
    return;
  }
  if (!lastFaceRect) {
    alert('No face detected. Please align your face within the frame.');
    return;
  }
  
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
    body: JSON.stringify({ name, rollNo, frames, features })
  });
  
  const data = await res.json();
  if (data.ok) {
    alert(`✅ ${name} registered successfully with multi-pose training!`);
    inputName.value = ''; 
    inputRoll.value = '';
    loadStudents();
  } else {
    alert(data.error || 'Registration failed');
  }
  
  // Restore
  helpDiv.textContent = originalHelp;
  helpDiv.style = '';
}

async function takeAttendance() {
  if (!lastFaceRect) {
    alert('No face detected. Please align your face within the frame.');
    return;
  }
  
  const feature = faceToFeature(lastFaceRect);
  const res = await fetch('/api/recognize', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ feature }) 
  });
  const data = await res.json();
  
  if (data.recognized) {
    alert(`✅ Attendance marked for ${data.name} (Roll: ${data.rollNo})`);
    loadStudents();
  } else {
    alert('❌ Face not recognized. Please register first.');
  }
}

async function sendAttendance() {
  const res = await fetch('/api/send-attendance', { method: 'POST' });
  const data = await res.json();
  if (data.ok) {
    alert('Attendance Sent Successfully');
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

function renderStudents(items) {
  studentsDiv.innerHTML = '';
  studentCount.textContent = items.length;
  
  for (const s of items) {
    const el = document.createElement('div');
    el.className = 'student';
    const initials = s.name?.[0]?.toUpperCase() || '?';
    el.innerHTML = `
      <div class="avatar">${initials}</div>
      <div class="meta">
        <div class="name">${s.name}</div>
        <div class="roll">Roll: ${s.rollNo}</div>
        <div class="time">${s.time}</div>
      </div>
      <div class="student-actions">
        <span class="badge ${s.status === 'Present' ? 'present' : 'absent'}">${s.status}</span>
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

btnRegister.addEventListener('click', registerStudent);
btnAttendance.addEventListener('click', takeAttendance);
btnSend.addEventListener('click', sendAttendance);
btnClearAttendance.addEventListener('click', clearAttendance);
btnClearAll.addEventListener('click', clearAllStudents);
btnStats.addEventListener('click', showStats);

startCamera();
loadStudents();
