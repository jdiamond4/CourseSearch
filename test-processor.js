/**
 * Test SIS Processor with sample data
 */

const SISProcessor = require('./utils/sisProcessor');

// Sample data matching the actual SIS API format
const sampleData = {
  classes: [
    {
      term: "1262",
      subject: "CS",
      catalog_nbr: "2120",
      class_nbr: "20001",
      class_section: "001",
      descr: "Discrete Mathematics and Theory 1",
      units: "3",
      component: "LEC",
      section_type: "Lecture",
      class_capacity: "180",
      enrollment_total: "165",
      enrollment_available: "15",
      wait_cap: "20",
      wait_tot: "0",
      enrl_stat: "O",
      enrl_stat_descr: "Open",
      instructors: [
        { name: "Nathan Brunelle", email: "brunelle@virginia.edu" }
      ],
      meetings: [
        {
          days: "TuTh",
          start_time: "14.00.00.000000",
          end_time: "15.15.00.000000",
          bldg_cd: "OLS",
          room: "009",
          facility_descr: "Olsson Hall 009"
        }
      ],
      start_dt: "01/14/2026",
      end_dt: "04/28/2026",
      campus: "MAIN",
      campus_descr: "Main Campus",
      instruction_mode: "P",
      instruction_mode_descr: "In Person",
      grading_basis: "Graded"
    },
    {
      term: "1262",
      subject: "CS",
      catalog_nbr: "2120",
      class_nbr: "20002",
      class_section: "002",
      descr: "Discrete Mathematics and Theory 1",
      units: "3",
      component: "LEC",
      section_type: "Lecture",
      class_capacity: "180",
      enrollment_total: "178",
      enrollment_available: "2",
      wait_cap: "20",
      wait_tot: "3",
      enrl_stat: "O",
      enrl_stat_descr: "Open",
      instructors: [
        { name: "Nathan Brunelle", email: "brunelle@virginia.edu" }
      ],
      meetings: [
        {
          days: "TuTh",
          start_time: "15.30.00.000000",
          end_time: "16.45.00.000000",
          bldg_cd: "OLS",
          room: "009",
          facility_descr: "Olsson Hall 009"
        }
      ],
      start_dt: "01/14/2026",
      end_dt: "04/28/2026"
    },
    {
      term: "1262",
      subject: "CS",
      catalog_nbr: "3140",
      class_nbr: "30001",
      class_section: "001",
      descr: "Software Development Essentials",
      units: "3",
      component: "LEC",
      section_type: "Lecture",
      class_capacity: "120",
      enrollment_total: "120",
      enrollment_available: "0",
      wait_cap: "15",
      wait_tot: "8",
      enrl_stat: "W",
      enrl_stat_descr: "Wait List",
      instructors: [
        { name: "Mark Sherriff", email: "sherriff@virginia.edu" }
      ],
      meetings: [
        {
          days: "MoWe",
          start_time: "15.30.00.000000",
          end_time: "16.45.00.000000",
          bldg_cd: "THN",
          room: "211",
          facility_descr: "Thornton Hall 211"
        }
      ]
    },
    {
      term: "1262",
      subject: "CS",
      catalog_nbr: "3140",
      class_nbr: "30101",
      class_section: "100",
      descr: "Software Development Essentials",
      units: "3",
      component: "LAB",
      section_type: "Laboratory",
      class_capacity: "30",
      enrollment_total: "28",
      enrollment_available: "2",
      enrl_stat_descr: "Open",
      instructors: [
        { name: "TA Team", email: "cs-ta@virginia.edu" }
      ],
      meetings: [
        {
          days: "Fr",
          start_time: "13.00.00.000000",
          end_time: "13.50.00.000000",
          bldg_cd: "OLS",
          room: "120",
          facility_descr: "Olsson Hall 120"
        }
      ]
    },
    {
      term: "1262",
      subject: "MATH",
      catalog_nbr: "3351",
      class_nbr: "40001",
      class_section: "001",
      descr: "Elementary Linear Algebra",
      units: "3",
      component: "LEC",
      section_type: "Lecture",
      class_capacity: "60",
      enrollment_total: "45",
      enrollment_available: "15",
      enrl_stat_descr: "Open",
      instructors: [
        { name: "Julie Bergner", email: "jeb2md@virginia.edu" },
        { name: "Thomas Koberda", email: "tmk5a@virginia.edu" }
      ],
      meetings: [
        {
          days: "MoWeFr",
          start_time: "10.00.00.000000",
          end_time: "10.50.00.000000",
          bldg_cd: "GIL",
          room: "130",
          facility_descr: "Gilmer Hall 130"
        }
      ]
    }
  ]
};

console.log('🧪 Testing SIS Processor\n');
console.log('=' .repeat(80));

const processor = new SISProcessor();

// Process the data
console.log('\n📥 Processing SIS API response...\n');
const courses = processor.processSISResponse(sampleData, '1262');

console.log(`✅ Processed into ${courses.length} unique courses\n`);
console.log('=' .repeat(80));

// Display each course
courses.forEach((course, index) => {
  console.log(`\n\n📚 COURSE ${index + 1}: ${course.subject} ${course.catalog_nbr} - ${course.title}`);
  console.log('─'.repeat(80));
  console.log(`   Units: ${course.units}`);
  console.log(`   Term: ${course.term}`);
  
  // Show lecture sections
  if (course.sections.length > 0) {
    console.log(`\n   📖 LECTURE SECTIONS (${course.sections.length}):`);
    course.sections.forEach(section => {
      console.log(`\n      Section ${section.sectionNumber} [${section.component}]`);
      console.log(`      • Instructor: ${section.instructor}`);
      console.log(`      • Email: ${section.instructorEmail}`);
      console.log(`      • Schedule: ${section.schedule.days.join(' ')} @ ${section.schedule.startTime.substring(0, 5)} - ${section.schedule.endTime.substring(0, 5)}`);
      console.log(`      • Location: ${section.schedule.location}`);
      console.log(`      • Enrollment: ${section.enrollment.current}/${section.enrollment.max} (${section.enrollment.available} seats available)`);
      if (section.enrollment.waitlist > 0) {
        console.log(`      • Waitlist: ${section.enrollment.waitlist}/${section.enrollment.waitlistCapacity}`);
      }
      console.log(`      • Status: ${section.status}`);
      if (section.dates.start) {
        console.log(`      • Dates: ${section.dates.start} - ${section.dates.end}`);
      }
    });
  }
  
  // Show discussion/lab sections
  if (course.discussions.length > 0) {
    console.log(`\n   🔬 DISCUSSION/LAB SECTIONS (${course.discussions.length}):`);
    course.discussions.forEach(section => {
      console.log(`\n      Section ${section.sectionNumber} [${section.component}]`);
      console.log(`      • Instructor: ${section.instructor}`);
      console.log(`      • Schedule: ${section.schedule.days.join(' ')} @ ${section.schedule.startTime.substring(0, 5)} - ${section.schedule.endTime.substring(0, 5)}`);
      console.log(`      • Location: ${section.schedule.location}`);
      console.log(`      • Enrollment: ${section.enrollment.current}/${section.enrollment.max}`);
      console.log(`      • Status: ${section.status}`);
    });
  }
  
  // Validate
  const validation = processor.validateCourseDocument(course);
  console.log(`\n   ${validation.isValid ? '✅' : '❌'} Validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`);
  if (!validation.isValid) {
    validation.errors.forEach(err => console.log(`      - ${err}`));
  }
});

// Show statistics
console.log('\n\n' + '='.repeat(80));
console.log('\n📊 STATISTICS:\n');
const stats = processor.getStatistics(courses);
console.log(`   Total Courses: ${stats.totalCourses}`);
console.log(`   Total Lecture Sections: ${stats.totalSections}`);
console.log(`   Total Lab/Discussion Sections: ${stats.totalDiscussions}`);
console.log(`   Subjects: ${stats.subjects.join(', ')}`);
console.log(`   Components Found: ${stats.components.join(', ')}`);

// Show how it looks in MongoDB format
console.log('\n\n' + '='.repeat(80));
console.log('\n📄 SAMPLE MONGODB DOCUMENT (First Course):\n');
console.log(JSON.stringify(courses[0], null, 2));

console.log('\n\n✅ Test Complete!\n');

