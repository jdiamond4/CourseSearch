class Course {
  constructor(mnemonic, number, title = '') {
    this.mnemonic = mnemonic;        // String (e.g., 'CS')
    this.number = number;             // 4-digit int (e.g., 2120)
    this.title = title;               // String (e.g., 'Introduction to Programming')
    this.sections = [];               // Array of Section objects (Lectures)
    this.discussions = [];            // Array of Discussion objects (Labs, Discussions, etc.)
  }

  addSection(section) {
    this.sections.push(section);
  }

  addDiscussion(discussion) {
    this.discussions.push(discussion);
  }

  // Get total enrollment across all sections
  getTotalEnrollment() {
    return this.sections.reduce((total, section) => total + section.currentEnrollment, 0);
  }

  // Get total capacity across all sections
  getTotalCapacity() {
    return this.sections.reduce((total, section) => total + section.maxEnrollment, 0);
  }

  // Get average GPA across all sections
  getAverageGPA() {
    if (this.sections.length === 0) return 0;
    const totalGPA = this.sections.reduce((sum, section) => sum + section.averageGPA, 0);
    return totalGPA / this.sections.length;
  }

  // Check if course has available seats
  hasAvailableSeats() {
    return this.sections.some(section => section.currentEnrollment < section.maxEnrollment);
  }

  // Get course identifier (e.g., "CS 2120")
  getIdentifier() {
    return `${this.mnemonic} ${this.number}`;
  }
}

module.exports = Course; 