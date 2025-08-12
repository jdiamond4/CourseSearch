const Course = require('../models/Course');
const Section = require('../models/Section');
const Discussion = require('../models/Discussion');

class SISDataProcessor {
  constructor() {
    this.courses = new Map(); // Map of course identifier -> Course object
  }

  // Process raw SIS data and organize into Course objects
  processSISData(sisData) {
    if (!sisData || !Array.isArray(sisData.classes)) {
      throw new Error('Invalid SIS data format');
    }

    // Clear existing courses
    this.courses.clear();

    // Process each class from SIS
    sisData.classes.forEach(cls => {
      this.processClass(cls);
    });

    return Array.from(this.courses.values());
  }

  // Process individual class data
  processClass(cls) {
    const raw = cls.raw || {};
    const mnemonic = cls.subject;
    const number = parseInt(cls.catalog_nbr);
    const component = cls.component || raw.component || '';
    const sectionNumber = raw.class_section || '';

    if (!mnemonic || !number || !sectionNumber) {
      console.warn('Skipping class with missing data:', cls);
      return;
    }

    const courseId = `${mnemonic} ${number}`;
    
    // Get or create course
    let course = this.courses.get(courseId);
    if (!course) {
      const title = raw.descr || '';
      course = new Course(mnemonic, number, title);
      this.courses.set(courseId, course);
    }

    // Determine if this is a lecture section or discussion/lab
    if (this.isLectureSection(component)) {
      const section = this.createSection(cls, raw);
      course.addSection(section);
    } else {
      const discussion = this.createDiscussion(cls, raw);
      course.addDiscussion(discussion);
    }
  }

  // Check if component represents a lecture section
  isLectureSection(component) {
    const lectureComponents = ['LEC', 'LECTURE', 'SEM', 'SEMINAR'];
    return lectureComponents.includes(component.toUpperCase());
  }

  // Create a Section object from SIS data
  createSection(cls, raw) {
    const sectionNumber = raw.class_section || '';
    const teacherName = this.extractTeacherName(raw);
    const { startTime, endTime } = this.parseTime(raw);
    const days = this.parseDays(raw);
    const location = raw.meetings?.[0]?.facility_descr || 'TBA';
    const status = this.determineStatus(raw);

    const section = new Section(sectionNumber, teacherName, startTime, endTime);
    section.setEnrollment(cls.enrollment_total || 0, cls.class_capacity || 0);
    section.setSchedule(days, location);
    section.setStatus(status);

    return section;
  }

  // Create a Discussion object from SIS data
  createDiscussion(cls, raw) {
    const sectionNumber = raw.class_section || '';
    const teacherName = this.extractTeacherName(raw);
    const { startTime, endTime } = this.parseTime(raw);
    const days = this.parseDays(raw);
    const location = raw.meetings?.[0]?.facility_descr || 'TBA';
    const status = this.determineStatus(raw);
    const type = this.determineDiscussionType(raw);

    const discussion = new Discussion(sectionNumber, teacherName, startTime, endTime);
    discussion.setEnrollment(cls.enrollment_total || 0, cls.class_capacity || 0);
    discussion.setSchedule(days, location);
    discussion.setStatus(status);
    discussion.setType(type);

    return discussion;
  }

  // Extract teacher name from SIS data
  extractTeacherName(raw) {
    if (raw.instructors && raw.instructors.length > 0) {
      return raw.instructors[0].name || 'TBA';
    }
    return 'TBA';
  }

  // Parse time from SIS data and convert to 24-hour format
  parseTime(raw) {
    const meeting = raw.meetings?.[0];
    if (!meeting) {
      return { startTime: 0, endTime: 0 };
    }

    const startTime = this.convertTimeTo24Hour(meeting.start_time);
    const endTime = this.convertTimeTo24Hour(meeting.end_time);

    return { startTime, endTime };
  }

  // Convert time string to 24-hour integer format
  convertTimeTo24Hour(timeStr) {
    if (!timeStr || timeStr === '') return 0;
    
    // Handle SIS time format: "13.00.00.000000" (HH.MM.SS.microseconds)
    const timeMatch = timeStr.match(/^(\d{1,2})\.(\d{2})\.\d{2}\.\d{6}$/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      return hours * 100 + minutes;
    }
    
    // Handle various other time formats from SIS (fallback)
    const timeMatch2 = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (timeMatch2) {
      let hours = parseInt(timeMatch2[1]);
      const minutes = parseInt(timeMatch2[2]);
      const period = timeMatch2[3].toUpperCase();
      
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      return hours * 100 + minutes;
    }
    
    return 0;
  }

  // Parse days from SIS data
  parseDays(raw) {
    const meeting = raw.meetings?.[0];
    if (!meeting || !meeting.days || meeting.days === 'TBA') {
      return [];
    }

    // Convert SIS day format to our format
    const dayMap = {
      'M': 'Mo', 'T': 'Tu', 'W': 'We', 'TH': 'Th', 'F': 'Fr', 'S': 'Sa', 'SU': 'Su'
    };

    const days = meeting.days.split(/(?<=[A-Z])(?=[A-Z])/);
    return days.map(day => dayMap[day] || day);
  }

  // Determine enrollment status
  determineStatus(raw) {
    if (raw.enrl_stat_descr) {
      return raw.enrl_stat_descr;
    }
    
    const enrolled = raw.enrollment_total || 0;
    const capacity = raw.class_capacity || 0;
    
    if (enrolled >= capacity) return 'Full';
    if (enrolled > 0) return 'Open';
    return 'Open';
  }

  // Determine discussion type based on component
  determineDiscussionType(raw) {
    const component = raw.component || '';
    const typeMap = {
      'LAB': 'Lab',
      'DIS': 'Discussion',
      'IND': 'Independent Study',
      'PRA': 'Practicum',
      'SEM': 'Seminar',
      'TUT': 'Tutorial'
    };
    
    return typeMap[component.toUpperCase()] || 'Discussion';
  }

  // Get all courses
  getCourses() {
    return Array.from(this.courses.values());
  }

  // Get course by identifier
  getCourse(identifier) {
    return this.courses.get(identifier);
  }

  // Get courses by subject
  getCoursesBySubject(subject) {
    return Array.from(this.courses.values()).filter(course => course.mnemonic === subject);
  }

  // Get courses with available seats
  getCoursesWithAvailableSeats() {
    return Array.from(this.courses.values()).filter(course => course.hasAvailableSeats());
  }
}

module.exports = SISDataProcessor; 