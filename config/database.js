const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hooslist', {
      serverSelectionTimeoutMS: 5000 // Fail fast after 5 seconds
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    // Don't exit - let the server handle the error and use CSV fallback
    throw error;
  }
};

module.exports = connectDB;
