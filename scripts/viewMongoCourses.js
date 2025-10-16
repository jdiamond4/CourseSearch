#!/usr/bin/env node
/**
 * View courses stored in MongoDB
 */

require('dotenv').config();
const connectDB = require('../config/database');
const MongoCourse = require('../models/MongoCourse');

async function main() {
  try {
    await connectDB();
    
    const term = process.argv[2] || '1262';
    const subject = process.argv[3];
    
    const query = { term };
    if (subject) {
      query.subject = subject;
    }
    
    const courses = await MongoCourse.find(query).sort({ subject: 1, catalog_nbr: 1 }).limit(10);
    
    console.log(`\n📚 Courses in MongoDB (term ${term}${subject ? ', subject ' + subject : ''}):\n`);
    console.log('='.repeat(80));
    
    courses.forEach((course, index) => {
      console.log(`\n${index + 1}. ${course.subject} ${course.catalog_nbr} - ${course.title}`);
      console.log(`   Sections: ${course.sections.length}, Discussions: ${course.discussions.length}`);
      
      if (course.sections.length > 0) {
        const section = course.sections[0];
        console.log(`   First section: ${section.sectionNumber}`);
        console.log(`     Instructor: ${section.instructor}`);
        console.log(`     Schedule: ${section.schedule.days.join(' ')} ${section.schedule.startTime.substring(0, 5)}`);
        console.log(`     Enrollment: ${section.enrollment.current}/${section.enrollment.max}`);
      }
    });
    
    const total = await MongoCourse.countDocuments(query);
    console.log(`\n\n📊 Total courses: ${total}`);
    console.log('(Showing first 10)\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

