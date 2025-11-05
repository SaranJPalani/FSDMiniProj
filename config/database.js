const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Default MongoDB Compass connection string
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_system';
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ MongoDB Connected Successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
