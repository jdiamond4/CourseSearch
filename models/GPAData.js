const mongoose = require('mongoose');

const gpaDataSchema = new mongoose.Schema({
  // Course identifiers
  subject: { type: String, required: true, index: true },
  catalog_nbr: { type: String, required: true },
  courseNumber: String, // Alias for catalog_nbr
  
  // Instructor information
  instructorName: { type: String, required: true },
  
  // GPA and rating data from CourseForum
  instructorGPA: String, // '3.94', 'N/A', etc.
  instructorRating: String, // '4.5/5'
  instructorDifficulty: String, // '2.8/5'
  instructorLastTaught: String, // 'Fall 2025'
  
  // Course-level data (if available)
  courseGPA: String,
  courseRating: String,
  courseDifficulty: String,
  
  // Metadata
  department: String, // Department name
  courseTitle: String,
  
}, {
  timestamps: true
});

// Compound index for efficient lookups
gpaDataSchema.index({ subject: 1, catalog_nbr: 1, instructorName: 1 });

// Static method to find GPA data for a course and instructor
gpaDataSchema.statics.findForInstructor = function(subject, catalogNbr, instructorName) {
  return this.findOne({ 
    subject, 
    catalog_nbr: catalogNbr, 
    instructorName 
  });
};

// Static method to find all GPA data for a course
gpaDataSchema.statics.findForCourse = function(subject, catalogNbr) {
  return this.find({ 
    subject, 
    catalog_nbr: catalogNbr 
  });
};

module.exports = mongoose.model('GPAData', gpaDataSchema);

