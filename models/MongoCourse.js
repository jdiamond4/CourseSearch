const mongoose = require('mongoose');

// Schema for individual sections (lectures, labs, discussions, etc.)
const sectionSchema = new mongoose.Schema({
  sectionNumber: { type: String, required: true },
  component: String, // LEC, LAB, DIS, SEM, etc.
  sectionType: String,
  teacherName: String,
  instructor: String, // Alias for teacherName
  
  // Schedule information
  schedule: {
    days: [String], // ['Mo', 'We', 'Fr']
    startTime: String, // Time in SIS format
    endTime: String,
    location: String,
    building: String,
    room: String
  },
  
  // Enrollment information
  enrollment: {
    current: Number,
    max: Number,
    available: Number,
    waitlist: Number,
    waitlistCapacity: Number
  },
  
  status: String, // 'Open', 'Closed', 'Wait List'
  
  // GPA and rating data from CourseForum
  gpaData: {
    instructorGPA: String,
    instructorRating: String,
    instructorDifficulty: String,
    instructorLastTaught: String
  },
  
  // Additional metadata
  startDate: String,
  endDate: String,
  campus: String,
  instructionMode: String,
  gradingBasis: String,
  topic: String,
  combinedSection: String,
  schedulePrint: String
});

// Main course schema
const courseSchema = new mongoose.Schema({
  // Semester identifier
  term: { type: String, required: true, index: true }, // '1262' for Spring 2026
  
  // Course identifiers
  subject: { type: String, required: true, index: true }, // 'CS', 'MATH', etc.
  catalog_nbr: { type: String, required: true }, // '2120', '3140', etc.
  
  // Course information
  title: { type: String, required: true },
  units: String,
  courseAttributes: String,
  courseAttributeValues: String,
  requirements: String,
  
  // Sections arrays
  sections: [sectionSchema], // Lectures
  discussions: [sectionSchema], // Labs, discussions, seminars, etc.
  
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Compound index for efficient queries
courseSchema.index({ term: 1, subject: 1, catalog_nbr: 1 }, { unique: true });
courseSchema.index({ term: 1, subject: 1 });
courseSchema.index({ term: 1, title: 'text' }); // For text search

// Virtual for course identifier
courseSchema.virtual('identifier').get(function() {
  return `${this.subject} ${this.catalog_nbr}`;
});

// Method to check if course has available seats
courseSchema.methods.hasAvailableSeats = function() {
  return this.sections.some(section => 
    section.enrollment && section.enrollment.available > 0
  );
};

// Method to get total enrollment
courseSchema.methods.getTotalEnrollment = function() {
  return this.sections.reduce((total, section) => 
    total + (section.enrollment?.current || 0), 0
  );
};

// Method to get total capacity
courseSchema.methods.getTotalCapacity = function() {
  return this.sections.reduce((total, section) => 
    total + (section.enrollment?.max || 0), 0
  );
};

module.exports = mongoose.model('Course', courseSchema);

