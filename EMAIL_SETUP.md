# 📧 Email Setup Guide for Attendance Reports

## What to Change

### 1. Update `.env` File

Open or create `.env` file in your project root and change these values:

```env
# NEW EMAIL SETTINGS - Replace with your values
EMAIL_FROM=your-attendance-email@gmail.com
EMAIL_PASSWORD=your-app-password-here
EMAIL_TO=recipient-email@gmail.com

# MongoDB and Server (keep these the same)
MONGODB_URI=mongodb://localhost:27017/attendance_system
PORT=3000
```

**What each setting means:**
- `EMAIL_FROM` - The Gmail account that will SEND the attendance reports
- `EMAIL_PASSWORD` - App-specific password for that Gmail account (NOT your regular password!)
- `EMAIL_TO` - The email address that will RECEIVE the attendance reports

---

## Setting Up Gmail to Send Emails

### Option 1: Using Gmail (Recommended)

#### Step 1: Enable 2-Factor Authentication
1. Go to: https://myaccount.google.com/security
2. Click **"2-Step Verification"**
3. Follow the steps to enable it (you'll need your phone)

#### Step 2: Generate App Password
1. Go to: https://myaccount.google.com/apppasswords
   - Or search "App passwords" in your Google Account settings
2. You may need to verify your password
3. Under "Select app" choose: **Mail**
4. Under "Select device" choose: **Other (Custom name)**
5. Type: **Attendance System**
6. Click **Generate**
7. **Copy the 16-character password** (it looks like: `abcd efgh ijkl mnop`)
8. Remove the spaces: `abcdefghijklmnop`
9. Use this in `EMAIL_PASSWORD` in your `.env` file

#### Step 3: Update Your .env File
```env
EMAIL_FROM=your-attendance-email@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
EMAIL_TO=where-to-send@gmail.com
```

---

### Option 2: Using Outlook/Hotmail

If you want to use Outlook instead of Gmail:

```env
EMAIL_FROM=your-email@outlook.com
EMAIL_PASSWORD=your-outlook-password
EMAIL_TO=recipient@email.com
```

**Then update `server-mongodb.js` line ~182:**

Change from:
```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: fromUser, pass: fromPass }
});
```

To:
```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp-mail.outlook.com',
  port: 587,
  secure: false,
  auth: { user: fromUser, pass: fromPass }
});
```

---

## Quick Setup Examples

### Example 1: Personal Gmail to Personal Email
```env
EMAIL_FROM=myattendanceapp@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
EMAIL_TO=myemail@gmail.com
```

### Example 2: School Gmail to Teacher Email
```env
EMAIL_FROM=attendance-cs101@school.edu
EMAIL_PASSWORD=xyzw1234abcd5678
EMAIL_TO=teacher@school.edu
```

### Example 3: Gmail to Multiple Recipients
If you want to send to multiple emails, use commas:
```env
EMAIL_TO=teacher1@email.com,teacher2@email.com,admin@email.com
```

---

## Testing Your Email Setup

### 1. After updating `.env`, restart your server:
```powershell
# Stop the server (Ctrl+C)
# Then start again:
npm start
```

### 2. Register a test student

### 3. Mark attendance

### 4. Click "Send Attendance" button

### 5. Check if email arrives
- Check inbox of `EMAIL_TO` address
- Check spam folder if not in inbox
- Email should have `attendanceSheet.csv` attached

---

## Common Issues & Solutions

### ❌ "Invalid login: 535-5.7.8 Username and Password not accepted"

**Problem:** Wrong password or app password not set up

**Solutions:**
1. Make sure you're using an **App Password**, not your regular Gmail password
2. Remove spaces from the app password
3. Regenerate a new app password
4. Check if 2-Factor Authentication is enabled

---

### ❌ "connect ETIMEDOUT" or "connect ECONNREFUSED"

**Problem:** Firewall or network blocking SMTP

**Solutions:**
1. Check your firewall settings
2. Try a different network (maybe your work/school blocks SMTP)
3. Check if antivirus is blocking port 587
4. Try port 465 with `secure: true`:
```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,  // Changed to true
  auth: { user: fromUser, pass: fromPass }
});
```

---

### ❌ Email goes to spam folder

**Solutions:**
1. Mark as "Not Spam" in Gmail
2. Add sender to contacts
3. Create a filter to never send to spam:
   - Gmail Settings → Filters → Create new filter
   - From: `your-attendance-email@gmail.com`
   - Never send to spam ✓

---

### ❌ "self signed certificate in certificate chain"

**Problem:** Corporate firewall or proxy

**Solution:** Add this to the transporter config:
```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: fromUser, pass: fromPass },
  tls: {
    rejectUnauthorized: false  // Add this line
  }
});
```

---

## Security Best Practices

### ✅ DO:
- Use App Passwords (not your main Gmail password)
- Keep `.env` file private (it's already in `.gitignore`)
- Use a dedicated email account for sending (not your personal email)
- Enable 2-Factor Authentication on the sending account

### ❌ DON'T:
- Share your `.env` file
- Commit `.env` to Git/GitHub
- Use your personal email password
- Share app passwords with others

---

## Advanced: Using a Different SMTP Service

### SendGrid (Free tier: 100 emails/day)
```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  auth: {
    user: 'apikey',
    pass: 'your-sendgrid-api-key'
  }
});
```

### Mailgun
```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp.mailgun.org',
  port: 587,
  auth: {
    user: 'postmaster@your-domain.mailgun.org',
    pass: 'your-mailgun-password'
  }
});
```

---

## Checklist

Before testing, make sure:
- [ ] `.env` file exists in project root
- [ ] `EMAIL_FROM` is set to your Gmail
- [ ] `EMAIL_PASSWORD` is the App Password (16 characters, no spaces)
- [ ] `EMAIL_TO` is set to recipient email
- [ ] 2-Factor Authentication is enabled on Gmail
- [ ] Server restarted after changing `.env`
- [ ] Gmail "Less secure app access" is OFF (use App Password instead)

---

## File Locations to Update

### 1. `.env` file (in project root)
```
c:\Users\saran\Downloads\fsdfinalgrounds\.env
```
**This is the ONLY file you need to change for email settings!**

### 2. If using non-Gmail SMTP (optional):
Update `server-mongodb.js` around line 182:
```
c:\Users\saran\Downloads\fsdfinalgrounds\server-mongodb.js
```

---

## Quick Copy-Paste Template

Copy this to your `.env` file and fill in your details:

```env
# ===== EMAIL CONFIGURATION =====
# Gmail account that sends attendance reports
EMAIL_FROM=

# App Password (16 chars) from https://myaccount.google.com/apppasswords
EMAIL_PASSWORD=

# Email address(es) to receive reports (comma-separated for multiple)
EMAIL_TO=

# ===== DATABASE & SERVER =====
MONGODB_URI=mongodb://localhost:27017/attendance_system
PORT=3000
```

---

## Need Help?

1. **Test Gmail login manually:** https://accounts.google.com/signin
2. **Check App Passwords:** https://myaccount.google.com/apppasswords
3. **Gmail SMTP info:** https://support.google.com/mail/answer/7126229

---

**Once set up, attendance emails will be sent automatically when you click "Send Attendance"!** 📧✅
