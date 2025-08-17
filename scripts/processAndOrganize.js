const fs = require('fs');
const path = require('path');
const SISDataProcessor = require('../utils/sisDataProcessor');

async function processAndOrganize(term, subject, page) {
  try {
    // Load cached SIS data
    const dataPath = path.join(__dirname, '..', 'data', `term-${term}-subject-${subject}-page-${page}.json`);
    
    if (!fs.existsSync(dataPath)) {
      console.error(`No cached data found for term ${term}, subject ${subject}, page ${page}`);
      console.log('Please run fetchSis.js first to get the data.');
      return;
    }

    const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Process the data using our new structure
    const processor = new SISDataProcessor();
    const courses = processor.processSISData(rawData);
    
    console.log(`\n=== Processed ${courses.length} courses from SIS data ===\n`);
    
    // Display organized course information
    courses.forEach(course => {
      console.log(`📚 ${course.getIdentifier()}`);
      console.log(`   Average GPA: ${course.getAverageGPA().toFixed(2)}`);
      console.log(`   Available Seats: ${course.hasAvailableSeats() ? 'Yes' : 'No'}`);
      
      if (course.sections.length > 0) {
        console.log(`   📖 Lecture Sections (${course.sections.length}):`);
        course.sections.forEach(section => {
          console.log(`      Section ${section.sectionNumber}: ${section.teacherName}`);
          console.log(`        Time: ${section.getTimeRange()}`);
          console.log(`        Days: ${section.getDaysString()}`);
          console.log(`        Location: ${section.location}`);
          console.log(`        Enrollment: ${section.currentEnrollment}/${section.maxEnrollment} (${section.status})`);
          console.log(`        GPA: ${section.averageGPA.toFixed(2)}`);
        });
      }
      
      if (course.discussions.length > 0) {
        console.log(`   💬 ${course.discussions[0].type}s (${course.discussions.length}):`);
        course.discussions.forEach(discussion => {
          console.log(`      Section ${discussion.sectionNumber}: ${discussion.teacherName}`);
          console.log(`        Time: ${discussion.getTimeRange()}`);
          console.log(`        Days: ${discussion.getDaysString()}`);
          console.log(`        Location: ${discussion.location}`);
          console.log(`        Enrollment: ${discussion.currentEnrollment}/${discussion.maxEnrollment} (${discussion.status})`);
        });
      }
      
      console.log(''); // Empty line for readability
    });
    
    // Save processed data for later use
    const outputPath = path.join(__dirname, '..', 'data', `organized-term-${term}-subject-${subject}-page-${page}.json`);
    const organizedData = {
      term,
      subject,
      page,
      processed_at: new Date().toISOString(),
      courses: courses.map(course => ({
        mnemonic: course.mnemonic,
        number: course.number,
        title: course.title,
        sections: course.sections.map(section => ({
          sectionNumber: section.sectionNumber,
          teacherName: section.teacherName,
          startTime: section.startTime,
          endTime: section.endTime,
          averageGPA: section.averageGPA,
          currentEnrollment: section.currentEnrollment,
          maxEnrollment: section.maxEnrollment,
          days: section.days,
          location: section.location,
          status: section.status
        })),
        discussions: course.discussions.map(discussion => ({
          sectionNumber: discussion.sectionNumber,
          teacherName: discussion.teacherName,
          startTime: discussion.startTime,
          endTime: discussion.endTime,
          currentEnrollment: discussion.currentEnrollment,
          maxEnrollment: discussion.maxEnrollment,
          days: discussion.days,
          location: discussion.location,
          status: discussion.status,
          type: discussion.type
        }))
      }))
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(organizedData, null, 2));
    console.log(`✅ Organized data saved to: ${outputPath}`);
    
    // Show some statistics
    const totalSections = courses.reduce((sum, course) => sum + course.sections.length, 0);
    const totalDiscussions = courses.reduce((sum, course) => sum + course.discussions.length, 0);
    const totalEnrollment = courses.reduce((sum, course) => {
      const sectionEnrollment = course.sections.reduce((sSum, section) => sSum + section.currentEnrollment, 0);
      const discussionEnrollment = course.discussions.reduce((dSum, discussion) => dSum + discussion.currentEnrollment, 0);
      return sum + sectionEnrollment + discussionEnrollment;
    }, 0);
    const totalCapacity = courses.reduce((sum, course) => {
      const sectionCapacity = course.sections.reduce((sSum, section) => sSum + section.maxEnrollment, 0);
      const discussionCapacity = course.discussions.reduce((dSum, discussion) => dSum + discussion.maxEnrollment, 0);
      return sum + sectionCapacity + discussionCapacity;
    }, 0);
    
    console.log('\n📊 Summary Statistics:');
    console.log(`   Total Courses: ${courses.length}`);
    console.log(`   Total Lecture Sections: ${totalSections}`);
    console.log(`   Total Discussion/Lab Sections: ${totalDiscussions}`);
    console.log(`   Total Enrollment: ${totalEnrollment}/${totalCapacity}`);
    console.log(`   Overall Fill Rate: ${((totalEnrollment / totalCapacity) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('Error processing and organizing data:', error);
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const term = args.find(arg => arg.startsWith('--term='))?.split('=')[1];
  const subject = args.find(arg => arg.startsWith('--subject='))?.split('=')[1];
  const page = args.find(arg => arg.startsWith('--page='))?.split('=')[1];
  
  if (!term || !subject || !page) {
    console.log('Usage: node processAndOrganize.js --term=<TERM> --subject=<SUBJECT> --page=<PAGE>');
    console.log('  --term: Term code (e.g., 1258 for Fall 2025)');
    console.log('  --subject: Subject code (e.g., MATH, CS, PHYS)');
    console.log('  --page: Page number (default: 1)');
    console.log('');
    console.log('Examples:');
    console.log('  node processAndOrganize.js --term=1258 --subject=MATH --page=1');
    console.log('  node processAndOrganize.js --term=1258 --subject=CS --page=1');
    process.exit(1);
  }
  
  processAndOrganize(term, subject, page);
}

module.exports = { processAndOrganize }; 