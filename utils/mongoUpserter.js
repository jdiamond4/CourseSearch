/**
 * MongoDB Upserter
 * Handles inserting and updating course data in MongoDB with proper error handling
 */

const MongoCourse = require('../models/MongoCourse');
const Semester = require('../models/Semester');

class MongoUpserter {
  constructor() {
    this.stats = {
      inserted: 0,
      updated: 0,
      failed: 0,
      errors: []
    };
  }

  /**
   * Upsert a single course document
   * @param {Object} courseDoc - Processed course document
   * @returns {Object} Result of the operation
   */
  async upsertCourse(courseDoc) {
    try {
      const filter = {
        term: courseDoc.term,
        subject: courseDoc.subject,
        catalog_nbr: courseDoc.catalog_nbr
      };

      const result = await MongoCourse.findOneAndUpdate(
        filter,
        courseDoc,
        {
          upsert: true,
          new: true,
          runValidators: true
        }
      );

      return {
        success: true,
        courseId: result._id,
        isNew: !result.isNew,
        course: `${courseDoc.subject} ${courseDoc.catalog_nbr}`
      };
    } catch (error) {
      this.stats.failed++;
      this.stats.errors.push({
        course: `${courseDoc.subject} ${courseDoc.catalog_nbr}`,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        course: `${courseDoc.subject} ${courseDoc.catalog_nbr}`
      };
    }
  }

  /**
   * Bulk upsert multiple courses
   * @param {Array} courseDocs - Array of processed course documents
   * @param {Object} options - Options for the operation
   * @returns {Object} Statistics about the operation
   */
  async bulkUpsertCourses(courseDocs, options = {}) {
    const { showProgress = true, continueOnError = true } = options;

    this.resetStats();
    const results = [];

    console.log(`\n📦 Bulk upserting ${courseDocs.length} courses to MongoDB...\n`);

    for (let i = 0; i < courseDocs.length; i++) {
      const courseDoc = courseDocs[i];
      
      if (showProgress && (i + 1) % 10 === 0) {
        console.log(`   Progress: ${i + 1}/${courseDocs.length} courses processed...`);
      }

      try {
        // Check if course already exists
        const existing = await MongoCourse.findOne({
          term: courseDoc.term,
          subject: courseDoc.subject,
          catalog_nbr: courseDoc.catalog_nbr
        });

        const isUpdate = !!existing;

        // Upsert the course
        const result = await MongoCourse.findOneAndUpdate(
          {
            term: courseDoc.term,
            subject: courseDoc.subject,
            catalog_nbr: courseDoc.catalog_nbr
          },
          courseDoc,
          {
            upsert: true,
            new: true,
            runValidators: true
          }
        );

        if (isUpdate) {
          this.stats.updated++;
        } else {
          this.stats.inserted++;
        }

        results.push({
          success: true,
          action: isUpdate ? 'updated' : 'inserted',
          course: `${courseDoc.subject} ${courseDoc.catalog_nbr}`,
          sections: courseDoc.sections.length,
          discussions: courseDoc.discussions.length
        });

      } catch (error) {
        this.stats.failed++;
        this.stats.errors.push({
          course: `${courseDoc.subject} ${courseDoc.catalog_nbr}`,
          error: error.message
        });

        results.push({
          success: false,
          course: `${courseDoc.subject} ${courseDoc.catalog_nbr}`,
          error: error.message
        });

        if (!continueOnError) {
          throw error;
        }
      }
    }

    return {
      stats: this.stats,
      results
    };
  }

  /**
   * Upsert courses for a specific subject/department
   * @param {Array} courseDocs - Course documents for one subject
   * @param {String} term - Semester term
   * @param {String} subject - Subject code
   * @param {Object} options - Options
   */
  async upsertSubject(courseDocs, term, subject, options = {}) {
    const { replaceExisting = false } = options;

    console.log(`\n📚 Upserting ${subject} courses for term ${term}...`);

    // If replaceExisting, delete old courses for this subject first
    if (replaceExisting) {
      const deleteResult = await MongoCourse.deleteMany({ term, subject });
      console.log(`   🗑️  Deleted ${deleteResult.deletedCount} existing ${subject} courses`);
    }

    // Bulk upsert
    const result = await this.bulkUpsertCourses(courseDocs, options);

    console.log(`\n   ✅ ${subject} complete:`);
    console.log(`      Inserted: ${result.stats.inserted}`);
    console.log(`      Updated: ${result.stats.updated}`);
    console.log(`      Failed: ${result.stats.failed}`);

    return result;
  }

  /**
   * Ensure semester exists in database
   * @param {String} term - Term code (e.g., '1262')
   * @param {String} name - Semester name (e.g., 'Spring 2026')
   * @param {Boolean} active - Is this the active semester
   */
  async ensureSemester(term, name, active = true) {
    try {
      const semester = await Semester.findOneAndUpdate(
        { term },
        { term, name, active },
        { upsert: true, new: true }
      );

      console.log(`\n📅 Semester: ${semester.name} (${semester.term}) - Active: ${semester.active}`);
      return semester;
    } catch (error) {
      console.error(`❌ Error ensuring semester: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get statistics for a term
   * @param {String} term - Term code
   */
  async getTermStatistics(term) {
    try {
      const courses = await MongoCourse.find({ term });
      
      const stats = {
        term,
        totalCourses: courses.length,
        totalSections: 0,
        totalDiscussions: 0,
        subjects: new Set(),
        subjectCounts: {}
      };

      courses.forEach(course => {
        stats.totalSections += course.sections.length;
        stats.totalDiscussions += course.discussions.length;
        stats.subjects.add(course.subject);
        
        if (!stats.subjectCounts[course.subject]) {
          stats.subjectCounts[course.subject] = 0;
        }
        stats.subjectCounts[course.subject]++;
      });

      return {
        ...stats,
        subjects: Array.from(stats.subjects).sort()
      };
    } catch (error) {
      console.error(`❌ Error getting term statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete courses for a specific subject and term
   * @param {String} term - Term code
   * @param {String} subject - Subject code
   */
  async deleteSubject(term, subject) {
    try {
      const result = await MongoCourse.deleteMany({ term, subject });
      console.log(`🗑️  Deleted ${result.deletedCount} courses for ${subject} in term ${term}`);
      return result.deletedCount;
    } catch (error) {
      console.error(`❌ Error deleting subject: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete all courses for a term
   * @param {String} term - Term code
   */
  async deleteTerm(term) {
    try {
      const result = await MongoCourse.deleteMany({ term });
      console.log(`🗑️  Deleted ${result.deletedCount} courses for term ${term}`);
      return result.deletedCount;
    } catch (error) {
      console.error(`❌ Error deleting term: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      inserted: 0,
      updated: 0,
      failed: 0,
      errors: []
    };
  }

  /**
   * Get current statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Print error summary
   */
  printErrors() {
    if (this.stats.errors.length === 0) {
      console.log('\n✅ No errors!');
      return;
    }

    console.log(`\n⚠️  Errors (${this.stats.errors.length}):`);
    this.stats.errors.forEach((err, index) => {
      console.log(`   ${index + 1}. ${err.course}: ${err.error}`);
    });
  }

  /**
   * Validate MongoDB connection
   */
  async validateConnection() {
    try {
      // Try to count documents (lightweight operation)
      await MongoCourse.countDocuments();
      return true;
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      return false;
    }
  }
}

module.exports = MongoUpserter;

