class Section {
  constructor(sectionNumber, teacherName, startTime, endTime, averageGPA = 0.0) {
    this.sectionNumber = sectionNumber;     // String (e.g., '001', '002')
    this.teacherName = teacherName;         // String (e.g., 'John Smith')
    this.startTime = startTime;             // 24-hour int (e.g., 1430 for 2:30 PM)
    this.endTime = endTime;                 // 24-hour int (e.g., 1545 for 3:45 PM)
    this.averageGPA = averageGPA;           // Double out of 4.0 (e.g., 3.94)
    this.currentEnrollment = 0;             // Current number of enrolled students
    this.maxEnrollment = 0;                 // Maximum capacity
    this.days = [];                         // Array of day strings (e.g., ['Mo', 'We', 'Fr'])
    this.location = '';                     // Building and room (e.g., 'Rice Hall 130')
    this.status = 'Unknown';                // Enrollment status (e.g., 'Open', 'Full', 'Waitlist')
  }

  // Set enrollment data
  setEnrollment(current, max) {
    this.currentEnrollment = current;
    this.maxEnrollment = max;
  }

  // Set schedule information
  setSchedule(days, location) {
    this.days = days;
    this.location = location;
  }

  // Set enrollment status
  setStatus(status) {
    this.status = status;
  }

  // Check if section has available seats
  hasAvailableSeats() {
    return this.currentEnrollment < this.maxEnrollment;
  }

  // Get enrollment percentage
  getEnrollmentPercentage() {
    if (this.maxEnrollment === 0) return 0;
    return (this.currentEnrollment / this.maxEnrollment) * 100;
  }

  // Get available seats
  getAvailableSeats() {
    return Math.max(0, this.maxEnrollment - this.currentEnrollment);
  }

  // Format time from 24-hour int to readable string
  formatTime(time24) {
    const hours = Math.floor(time24 / 100);
    const minutes = time24 % 100;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  // Get formatted time range
  getTimeRange() {
    if (this.startTime === 0 || this.endTime === 0) {
      return 'TBA';
    }
    return `${this.formatTime(this.startTime)} - ${this.formatTime(this.endTime)}`;
  }

  // Get formatted days string
  getDaysString() {
    return this.days.join(' ');
  }
}

module.exports = Section; 