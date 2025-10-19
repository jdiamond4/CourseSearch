const Course = require('../models/Course');
const Section = require('../models/Section');
const Discussion = require('../models/Discussion');

/**
 * Convert MongoDB course document to Course model instance
 * This preserves all the methods from your existing Course/Section/Discussion classes
 */
function mongoToCourse(mongoData) {
  const course = new Course(
    mongoData.subject, 
    parseInt(mongoData.catalog_nbr), 
    mongoData.title
  );
  
  // Convert sections
  if (mongoData.sections && mongoData.sections.length > 0) {
    mongoData.sections.forEach(sectionData => {
      const section = new Section(
        sectionData.sectionNumber,
        sectionData.teacherName || sectionData.instructor || 'TBA',
        parseTime(sectionData.schedule?.startTime),
        parseTime(sectionData.schedule?.endTime),
        parseFloat(sectionData.gpaData?.instructorGPA) || 0.0
      );
      
      // Set enrollment
      if (sectionData.enrollment) {
        section.setEnrollment(
          sectionData.enrollment.current || 0,
          sectionData.enrollment.max || 0
        );
      }
      
      // Set schedule
      section.setSchedule(
        sectionData.schedule?.days || [],
        sectionData.schedule?.location || 'TBA'
      );
      
      // Set status
      section.setStatus(sectionData.status || 'Unknown');
      
      // Add GPA data as additional properties
      if (sectionData.gpaData) {
        section.instructorGPA = sectionData.gpaData.instructorGPA;
        section.instructorRating = sectionData.gpaData.instructorRating;
        section.instructorDifficulty = sectionData.gpaData.instructorDifficulty;
        section.instructorLastTaught = sectionData.gpaData.instructorLastTaught;
      }
      
      course.addSection(section);
    });
  }
  
  // Convert discussions
  if (mongoData.discussions && mongoData.discussions.length > 0) {
    mongoData.discussions.forEach(discussionData => {
      const discussion = new Discussion(
        discussionData.sectionNumber,
        discussionData.teacherName || discussionData.instructor || 'TBA',
        parseTime(discussionData.schedule?.startTime),
        parseTime(discussionData.schedule?.endTime)
      );
      
      // Set enrollment
      if (discussionData.enrollment) {
        discussion.setEnrollment(
          discussionData.enrollment.current || 0,
          discussionData.enrollment.max || 0
        );
      }
      
      // Set schedule
      discussion.setSchedule(
        discussionData.schedule?.days || [],
        discussionData.schedule?.location || 'TBA'
      );
      
      // Set status
      discussion.setStatus(discussionData.status || 'Unknown');
      
      // Set type based on component
      if (discussionData.component) {
        const typeMap = {
          'LAB': 'Lab',
          'DIS': 'Discussion',
          'SEM': 'Seminar',
          'IND': 'Independent Study',
          'PRA': 'Practicum',
          'TUT': 'Tutorial'
        };
        discussion.setType(typeMap[discussionData.component] || 'Discussion');
      }
      
      // Add GPA data as additional properties
      if (discussionData.gpaData) {
        discussion.instructorGPA = discussionData.gpaData.instructorGPA;
        discussion.instructorRating = discussionData.gpaData.instructorRating;
        discussion.instructorDifficulty = discussionData.gpaData.instructorDifficulty;
        discussion.instructorLastTaught = discussionData.gpaData.instructorLastTaught;
      }
      
      course.addDiscussion(discussion);
    });
  }
  
  // Add hasGPAOver method to course
  course.hasGPAOver = function(minGPA) {
    const allSections = [...this.sections, ...this.discussions];
    return allSections.some(section => {
      if (section.instructorGPA && section.instructorGPA !== 'N/A' && section.instructorGPA !== '—') {
        const gpa = parseFloat(section.instructorGPA);
        return !isNaN(gpa) && gpa >= minGPA;
      }
      return false;
    });
  };
  
  return course;
}

/**
 * Parse time string to 24-hour integer format
 * Handles SIS format: "13.00.00.000000"
 */
function parseTime(timeStr) {
  if (!timeStr || timeStr === '' || timeStr === 'TBA') return 0;
  
  // Handle SIS time format: "13.00.00.000000"
  const timeMatch = timeStr.match(/^(\d{1,2})\.(\d{2})\.\d{2}\.\d{6}$/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    return hours * 100 + minutes;
  }
  
  // Handle simple format like "1330" or 1330
  const numTime = parseInt(timeStr);
  if (!isNaN(numTime)) {
    return numTime;
  }
  
  return 0;
}

/**
 * Convert array of MongoDB course documents to Course model instances
 */
function mongoCoursesToModels(mongoCourses) {
  return mongoCourses.map(mongoToCourse);
}

/**
 * Create MongoDB course object from raw SIS data
 */
function sisDataToMongo(sisRow, term) {
  const sectionData = {
    sectionNumber: sisRow.class_section || '',
    component: sisRow.component || '',
    sectionType: sisRow.section_type || '',
    teacherName: sisRow.instructor_names || 'TBA',
    instructor: sisRow.instructor_names || 'TBA',
    
    schedule: {
      days: sisRow.meeting_days ? sisRow.meeting_days.split('') : [],
      startTime: sisRow.start_times || '',
      endTime: sisRow.end_times || '',
      location: sisRow.facilities || '',
      building: sisRow.buildings || '',
      room: sisRow.rooms || ''
    },
    
    enrollment: {
      current: parseInt(sisRow.enrollment_total) || 0,
      max: parseInt(sisRow.class_capacity) || 0,
      available: parseInt(sisRow.enrollment_available) || 0,
      waitlist: parseInt(sisRow.wait_tot) || 0,
      waitlistCapacity: parseInt(sisRow.wait_cap) || 0
    },
    
    status: determineStatus(sisRow.enrollment_available, sisRow.enrl_stat),
    
    startDate: sisRow.start_date || '',
    endDate: sisRow.end_date || '',
    campus: sisRow.campus_descr || '',
    instructionMode: sisRow.instruction_mode_descr || '',
    gradingBasis: sisRow.grading_basis || '',
    topic: sisRow.topic || '',
    combinedSection: sisRow.combined_section || '',
    schedulePrint: sisRow.schedule_print || ''
  };
  
  return {
    term,
    subject: sisRow.subject,
    catalog_nbr: sisRow.catalog_nbr,
    title: sisRow.course_title || 'No title available',
    units: sisRow.units || '',
    courseAttributes: sisRow.course_attributes || '',
    courseAttributeValues: sisRow.course_attribute_values || '',
    requirements: sisRow.rqmnt_designtn || '',
    sectionData
  };
}

/**
 * Determine enrollment status
 */
function determineStatus(available, status) {
  if (status === 'W') return 'Wait List';
  if (parseInt(available) > 0) return 'Open';
  return 'Closed';
}

module.exports = {
  mongoToCourse,
  mongoCoursesToModels,
  sisDataToMongo,
  parseTime,
  determineStatus
};

