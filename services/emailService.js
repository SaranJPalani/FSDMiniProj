const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    // Use explicit SMTP configuration for better reliability
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates
      }
    });

    // Verify connection on startup
    this.verifyConnection();
  }

  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('📧 Email service is ready');
    } catch (error) {
      console.error('❌ Email service error:', error.message);
    }
  }

  async sendAbsenceNotification(studentEmail, studentName, subject, timeslot) {
    const message = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: studentEmail,
      subject: `Attendance Alert - ${studentName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">🚨 Attendance Alert</h2>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Student Absence Notification</h3>
            
            <p><strong>Student:</strong> ${studentName}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Time Slot:</strong> ${timeslot}</p>
            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>
          </div>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px;">
            <p style="margin: 0; color: #856404;">
              <strong>📝 Note:</strong> This is an automated notification from the Face Recognition Attendance System. 
              Please contact your instructor if you believe this is an error.
            </p>
          </div>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          
          <p style="font-size: 12px; color: #666; text-align: center;">
            This email was sent automatically by the Attendance Management System.<br>
            Please do not reply to this email.
          </p>
        </div>
      `
    };

    try {
      const result = await this.transporter.sendMail(message);
      console.log(`📧 Absence notification sent to ${studentEmail}`);
      return {
        success: true,
        messageId: result.messageId,
        email: studentEmail
      };
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return {
        success: false,
        error: error.message,
        email: studentEmail
      };
    }
  }

  async sendTestEmail(email, testMessage = 'This is a test email from the Attendance System') {
    const message = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject: '🧪 Test Email - Attendance System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2e7d32;">✅ Test Email</h2>
          
          <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 16px;">${testMessage}</p>
          </div>
          
          <p style="color: #666;">
            If you received this email, the email service is working correctly! 🎉
          </p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          
          <p style="font-size: 12px; color: #666; text-align: center;">
            This is a test email from the Face Recognition Attendance System.
          </p>
        </div>
      `
    };

    try {
      const result = await this.transporter.sendMail(message);
      console.log(`📧 Test email sent to ${email}`);
      return {
        success: true,
        messageId: result.messageId,
        email: email
      };
    } catch (error) {
      console.error('❌ Failed to send test email:', error);
      return {
        success: false,
        error: error.message,
        email: email
      };
    }
  }
}

module.exports = new EmailService();