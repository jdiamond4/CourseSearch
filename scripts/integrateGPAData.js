const fs = require('fs');
const path = require('path');

class GPADataIntegrator {
  constructor() {
    this.gpaData = null;
    this.sisData = null;
    this.integratedData = null;
  }

  // Load GPA data from master CSV
  loadGPAData() {
    try {
      const csvPath = path.join(__dirname, '../data/master-gpa-data.csv');
      if (!fs.existsSync(csvPath)) {
        console.error('❌ Master GPA CSV not found. Please run scrapeCourseForum.js first to create it.');
        return false;
      }
      
      const csvContent = fs.readFileSync(csvPath, 'utf8');
      
      // Parse CSV content
      const lines = csvContent.trim().split('\n');
      const headers = lines[0].split(',');
      const data = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((header, index) => {
          row[header.trim()] = values[index] ? values[index].trim() : '';
        });
        data.push(row);
      }
      
      this.gpaData = data;
      console.log(`📊 Loaded ${this.gpaData.length} GPA records from master CSV`);
      return true;
    } catch (error) {
      console.error('❌ Error loading GPA data:', error.message);
      return false;
    }
  }

  // Load SIS data
  loadSISData() {
    try {
      // Allow specifying department and term via command line arguments
      const department = process.argv[2] || 'CS';
      const term = process.argv[3] || '1258';
      const page = process.argv[4] || '1';
      
      const sisPath = path.join(__dirname, `../data/organized-term-${term}-subject-${department}-page-${page}.json`);
      
      if (!fs.existsSync(sisPath)) {
        console.error(`❌ SIS data file not found: ${sisPath}`);
        console.log('💡 Usage: node scripts/integrateGPAData.js <DEPARTMENT> <TERM> <PAGE>');
        console.log('   Example: node scripts/integrateGPAData.js MATH 1258 1');
        console.log('   Example: node scripts/integrateGPAData.js CS 1258 1');
        return false;
      }
      
      this.sisData = JSON.parse(fs.readFileSync(sisPath, 'utf8'));
      console.log(`📚 Loaded SIS data for ${this.sisData.courses.length} courses from ${department} department`);
      return true;
    } catch (error) {
      console.error('❌ Error loading SIS data:', error.message);
      return false;
    }
  }

  // Find matching instructor GPA data
  findMatchingInstructor(teacherName, courseMnemonic, courseNumber) {
    if (!this.gpaData) return null;
    
    // Look for exact match on course mnemonic, number, and instructor name
    const match = this.gpaData.find(record => 
      record.department === courseMnemonic &&
      record.courseNumber === courseNumber.toString() &&
      record.instructorName === teacherName
    );
    
    return match;
  }

  // Integrate GPA data into SIS data
  integrateData() {
    if (!this.gpaData || !this.sisData) {
      console.error('❌ Cannot integrate: missing GPA or SIS data');
      return false;
    }

    console.log('🔗 Integrating GPA data with SIS data...');
    
    // Create a map for faster lookups
    const gpaMap = new Map();
    this.gpaData.forEach(record => {
      const key = `${record.department} ${record.courseNumber} ${record.instructorName}`;
      gpaMap.set(key, record);
    });

    // Integrate data
    this.integratedData = {
      ...this.sisData,
      gpa_integrated_at: new Date().toISOString(),
      courses: this.sisData.courses.map(course => {
        const enhancedCourse = { ...course };
        
        if (course.sections && course.sections.length > 0) {
          enhancedCourse.sections = course.sections.map(section => {
            const enhancedSection = { ...section };
            
            if (section.instructors && section.instructors.length > 0) {
              enhancedSection.instructors = section.instructors.map(instructor => {
                const enhancedInstructor = { ...instructor };
                
                // Find matching GPA data
                const gpaMatch = this.findMatchingInstructor(
                  instructor.name, 
                  course.mnemonic, 
                  course.number
                );
                
                if (gpaMatch) {
                  enhancedInstructor.gpaData = {
                    instructorGPA: gpaMatch.instructorGPA,
                    instructorRating: gpaMatch.instructorRating,
                    instructorDifficulty: gpaMatch.instructorDifficulty,
                    instructorLastTaught: gpaMatch.instructorLastTaught,
                    courseOverallGPA: gpaMatch.courseOverallGPA,
                    courseOverallRating: gpaMatch.courseOverallRating,
                    courseOverallDifficulty: gpaMatch.courseOverallDifficulty,
                    courseLastTaught: gpaMatch.courseLastTaught
                  };
                }
                
                return enhancedInstructor;
              });
            }
            
            return enhancedSection;
          });
        }
        
        return enhancedCourse;
      })
    };

    console.log('✅ GPA data integration completed');
    return true;
  }

  // Save integrated data
  saveIntegratedData() {
    if (!this.integratedData) {
      console.error('❌ No integrated data to save');
      return false;
    }

    try {
      const department = process.argv[2] || 'CS';
      const term = process.argv[3] || '1258';
      const page = process.argv[4] || '1';
      
      const outputPath = path.join(__dirname, `../data/integrated-term-${term}-subject-${department}-page-${page}.json`);
      
      // Ensure data directory exists
      const dataDir = path.dirname(outputPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, JSON.stringify(this.integratedData, null, 2));
      console.log(`💾 Integrated data saved to: ${outputPath}`);
      return true;
    } catch (error) {
      console.error('❌ Error saving integrated data:', error.message);
      return false;
    }
  }

  // Generate summary statistics
  generateSummary() {
    if (!this.integratedData) {
      console.log('❌ No integrated data available for summary');
      return;
    }

    const totalCourses = this.integratedData.courses.length;
    let coursesWithGPA = 0;
    let totalInstructors = 0;
    let instructorsWithGPA = 0;

    this.integratedData.courses.forEach(course => {
      if (course.sections) {
        course.sections.forEach(section => {
          if (section.instructors) {
            section.instructors.forEach(instructor => {
              totalInstructors++;
              if (instructor.gpaData) {
                instructorsWithGPA++;
              }
            });
          }
        });
      }
    });

    coursesWithGPA = this.integratedData.courses.filter(course => 
      course.sections && course.sections.some(section => 
        section.instructors && section.instructors.some(instructor => instructor.gpaData)
      )
    ).length;

    console.log('\n📊 Summary Statistics:');
    console.log(`   Total Courses: ${totalCourses}`);
    console.log(`   Courses with GPA Data: ${coursesWithGPA} (${((coursesWithGPA/totalCourses)*100).toFixed(1)}%)`);
    console.log(`   Total Instructors: ${totalInstructors}`);
    console.log(`   Instructors with GPA Data: ${instructorsWithGPA} (${((instructorsWithGPA/totalInstructors)*100).toFixed(1)}%)`);
  }

  // Main integration process
  async run() {
    console.log('🚀 Starting GPA data integration...');
    
    // Load data
    if (!this.loadGPAData()) {
      console.error('❌ Failed to load GPA data');
      return false;
    }
    
    if (!this.loadSISData()) {
      console.error('❌ Failed to load SIS data');
      return false;
    }
    
    // Integrate data
    if (!this.integrateData()) {
      console.error('❌ Failed to integrate data');
      return false;
    }
    
    // Save integrated data
    if (!this.saveIntegratedData()) {
      console.error('❌ Failed to save integrated data');
      return false;
    }
    
    // Generate summary
    this.generateSummary();
    
    console.log('\n🎉 GPA data integration completed successfully!');
    return true;
  }
}

async function main() {
  const integrator = new GPADataIntegrator();
  
  try {
    await integrator.run();
  } catch (error) {
    console.error('❌ Integration failed:', error);
    process.exit(1);
  }
}

// Run the integrator if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { GPADataIntegrator }; 