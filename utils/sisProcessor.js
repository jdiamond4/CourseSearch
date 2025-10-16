/**
 * SIS Data Processor
 * Processes raw SIS API responses and groups them by course for MongoDB storage
 */

class SISProcessor {
  constructor() {
    this.coursesMap = new Map();
  }

  /**
   * Process raw SIS API response and group classes by course
   * @param {Object} sisResponse - Raw response from SIS API with { classes: [...] }
   * @param {String} term - Semester term code (e.g., '1262')
   * @returns {Array} Array of course documents ready for MongoDB
   */
  processSISResponse(sisResponse, term) {
    if (!sisResponse || !Array.isArray(sisResponse.classes)) {
      throw new Error('Invalid SIS response format: expected { classes: [...] }');
    }

    this.coursesMap.clear();

    // Group classes by course
    sisResponse.classes.forEach(classItem => {
      this.processClass(classItem, term);
    });

    // Convert map to array
    return Array.from(this.coursesMap.values());
  }

  /**
   * Process individual class and add to appropriate course
   */
  processClass(classItem, term) {
    const courseKey = `${classItem.subject}-${classItem.catalog_nbr}`;
    
    // Get or create course document
    let courseDoc = this.coursesMap.get(courseKey);
    if (!courseDoc) {
      courseDoc = this.createCourseDocument(classItem, term);
      this.coursesMap.set(courseKey, courseDoc);
    }

    // Create section/discussion from this class
    const sectionData = this.createSectionData(classItem);

    // Determine if this is a lecture or discussion/lab
    if (this.isLectureSection(classItem.component)) {
      courseDoc.sections.push(sectionData);
    } else {
      courseDoc.discussions.push(sectionData);
    }
  }

  /**
   * Create a new course document structure
   */
  createCourseDocument(classItem, term) {
    return {
      term,
      subject: classItem.subject || '',
      catalog_nbr: classItem.catalog_nbr || '',
      title: classItem.descr || classItem.course_title || 'No title available',
      units: classItem.units || '',
      courseAttributes: classItem.crse_attr || classItem.course_attributes || '',
      courseAttributeValues: classItem.crse_attr_value || classItem.course_attribute_values || '',
      requirements: classItem.rqmnt_designtn || '',
      sections: [],
      discussions: []
    };
  }

  /**
   * Create section data from class item
   */
  createSectionData(classItem) {
    // Parse instructors
    const instructors = this.parseInstructors(classItem);
    const instructorName = instructors.map(i => i.name).join('; ') || 'TBA';
    const instructorEmail = instructors.map(i => i.email).filter(e => e).join('; ') || '';

    // Parse meetings/schedule
    const meetings = this.parseMeetings(classItem);
    const schedule = meetings.length > 0 ? meetings[0] : this.getDefaultSchedule();

    // Parse enrollment
    const enrollment = this.parseEnrollment(classItem);

    // Determine status
    const status = this.determineStatus(classItem);

    return {
      sectionNumber: classItem.class_section || '',
      classNumber: classItem.class_nbr || '',
      component: classItem.component || '',
      sectionType: classItem.section_type || '',
      classType: classItem.class_type || '',
      
      teacherName: instructorName,
      instructor: instructorName,
      instructorEmail: instructorEmail,
      
      schedule: {
        days: schedule.days,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        location: schedule.location,
        building: schedule.building,
        room: schedule.room
      },
      
      enrollment: {
        current: enrollment.current,
        max: enrollment.max,
        available: enrollment.available,
        waitlist: enrollment.waitlist,
        waitlistCapacity: enrollment.waitlistCapacity
      },
      
      status,
      
      dates: {
        start: classItem.start_dt || classItem.start_date || '',
        end: classItem.end_dt || classItem.end_date || ''
      },
      
      metadata: {
        campus: classItem.campus || '',
        campusDescr: classItem.campus_descr || '',
        location: classItem.location || '',
        locationDescr: classItem.location_descr || '',
        session: classItem.session_code || '',
        sessionDescr: classItem.session_descr || '',
        acadCareer: classItem.acad_career || '',
        acadCareerDescr: classItem.acad_career_descr || '',
        acadGroup: classItem.acad_group || '',
        acadOrg: classItem.acad_org || '',
        instructionMode: classItem.instruction_mode || '',
        instructionModeDescr: classItem.instruction_mode_descr || '',
        gradingBasis: classItem.grading_basis || '',
        topic: classItem.topic || '',
        combinedSection: classItem.combined_section || '',
        schedulePrint: classItem.schedule_print || ''
      },
      
      // Placeholder for GPA data (to be added later)
      gpaData: {
        instructorGPA: 'N/A',
        instructorRating: 'N/A',
        instructorDifficulty: 'N/A',
        instructorLastTaught: 'N/A'
      }
    };
  }

  /**
   * Parse instructors from class item
   */
  parseInstructors(classItem) {
    // Check if instructors array exists (raw SIS format)
    if (Array.isArray(classItem.instructors)) {
      return classItem.instructors.map(inst => ({
        name: inst.name || '',
        email: inst.email || ''
      }));
    }

    // Check if instructor_names exists (flattened format)
    if (classItem.instructor_names) {
      const names = classItem.instructor_names.split(';').map(n => n.trim());
      const emails = (classItem.instructor_emails || '').split(';').map(e => e.trim());
      return names.map((name, index) => ({
        name,
        email: emails[index] || ''
      }));
    }

    return [];
  }

  /**
   * Parse meetings/schedule from class item
   */
  parseMeetings(classItem) {
    // Check if meetings array exists (raw SIS format)
    if (Array.isArray(classItem.meetings) && classItem.meetings.length > 0) {
      return classItem.meetings.map(meeting => ({
        days: this.parseDays(meeting.days || ''),
        startTime: meeting.start_time || '',
        endTime: meeting.end_time || '',
        location: meeting.facility_descr || '',
        building: meeting.bldg_cd || '',
        room: meeting.room || ''
      }));
    }

    // Check for flattened format
    if (classItem.meeting_days || classItem.start_times) {
      return [{
        days: this.parseDays(classItem.meeting_days || ''),
        startTime: classItem.start_times || '',
        endTime: classItem.end_times || '',
        location: classItem.facilities || '',
        building: classItem.buildings || '',
        room: classItem.rooms || ''
      }];
    }

    return [];
  }

  /**
   * Parse days string into array
   * Converts "MoWeFr" to ["Mo", "We", "Fr"]
   */
  parseDays(daysString) {
    if (!daysString || daysString === 'TBA') return [];
    
    // Handle different day formats
    const dayPatterns = [
      { pattern: /Mo/g, value: 'Mo' },
      { pattern: /Tu/g, value: 'Tu' },
      { pattern: /We/g, value: 'We' },
      { pattern: /Th/g, value: 'Th' },
      { pattern: /Fr/g, value: 'Fr' },
      { pattern: /Sa/g, value: 'Sa' },
      { pattern: /Su/g, value: 'Su' }
    ];

    const days = [];
    dayPatterns.forEach(({ pattern, value }) => {
      if (pattern.test(daysString)) {
        days.push(value);
      }
    });

    return days;
  }

  /**
   * Parse enrollment data
   */
  parseEnrollment(classItem) {
    const current = parseInt(classItem.enrollment_total) || 0;
    const max = parseInt(classItem.class_capacity) || 0;
    const available = parseInt(classItem.enrollment_available) || Math.max(0, max - current);
    const waitlist = parseInt(classItem.wait_tot) || 0;
    const waitlistCapacity = parseInt(classItem.wait_cap) || 0;

    return {
      current,
      max,
      available,
      waitlist,
      waitlistCapacity
    };
  }

  /**
   * Determine enrollment status
   */
  determineStatus(classItem) {
    // Check for explicit status
    if (classItem.enrl_stat === 'W' || classItem.enrl_stat_descr === 'Wait List') {
      return 'Wait List';
    }

    if (classItem.enrl_stat_descr) {
      return classItem.enrl_stat_descr;
    }

    // Determine from enrollment numbers
    const available = parseInt(classItem.enrollment_available) || 0;
    if (available > 0) return 'Open';
    return 'Closed';
  }

  /**
   * Check if component is a lecture section
   */
  isLectureSection(component) {
    const lectureComponents = ['LEC', 'LECTURE', 'SEM', 'SEMINAR'];
    return lectureComponents.includes((component || '').toUpperCase());
  }

  /**
   * Get default schedule object
   */
  getDefaultSchedule() {
    return {
      days: [],
      startTime: '',
      endTime: '',
      location: 'TBA',
      building: '',
      room: ''
    };
  }

  /**
   * Validate course document
   */
  validateCourseDocument(courseDoc) {
    const errors = [];

    if (!courseDoc.term) errors.push('Missing term');
    if (!courseDoc.subject) errors.push('Missing subject');
    if (!courseDoc.catalog_nbr) errors.push('Missing catalog number');
    if (!courseDoc.title) errors.push('Missing title');

    if (courseDoc.sections.length === 0 && courseDoc.discussions.length === 0) {
      errors.push('Course has no sections or discussions');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get statistics about processed data
   */
  getStatistics(courseDocs) {
    const stats = {
      totalCourses: courseDocs.length,
      totalSections: 0,
      totalDiscussions: 0,
      subjects: new Set(),
      components: new Set()
    };

    courseDocs.forEach(course => {
      stats.totalSections += course.sections.length;
      stats.totalDiscussions += course.discussions.length;
      stats.subjects.add(course.subject);
      
      course.sections.forEach(s => stats.components.add(s.component));
      course.discussions.forEach(d => stats.components.add(d.component));
    });

    return {
      ...stats,
      subjects: Array.from(stats.subjects),
      components: Array.from(stats.components)
    };
  }
}

module.exports = SISProcessor;

