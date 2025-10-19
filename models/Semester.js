const mongoose = require('mongoose');

const semesterSchema = new mongoose.Schema({
  term: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  }, // '1262'
  
  name: { 
    type: String, 
    required: true 
  }, // 'Spring 2026'
  
  active: { 
    type: Boolean, 
    default: true 
  }, // Is this the current semester?
  
  startDate: Date,
  endDate: Date,
  
  // Metadata
  year: Number, // 2026
  season: String, // 'Spring', 'Fall', 'Summer'
  
}, {
  timestamps: true
});

// Static method to get active semester
semesterSchema.statics.getActive = function() {
  return this.findOne({ active: true });
};

// Static method to create or update semester
semesterSchema.statics.upsertSemester = async function(term, name, active = true) {
  return this.findOneAndUpdate(
    { term },
    { term, name, active },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('Semester', semesterSchema);

