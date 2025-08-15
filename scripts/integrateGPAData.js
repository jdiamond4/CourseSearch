const fs = require('fs');
const path = require('path');

class GPADataIntegrator {
  constructor() {
    this.gpaData = null;
    this.sisData = null;
    this.integratedData = null;
  }

  // Load GPA data from CSV
  loadGPAData() {
    try {
      const csvPath = path.join(__dirname, '../data/instructor-gpa-data.csv');
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
      console.log(`📊 Loaded ${this.gpaData.length} GPA records from CSV`);
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
      record.courseMnemonic === courseMnemonic &&
      record.courseNumber === courseNumber.toString() &&
      record.profFullName === teacherName
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
      const key = `${record.courseMnemonic} ${record.courseNumber} ${record.profFullName}`;
      gpaMap.set(key, record);
    });

    // Integrate data
    this.integratedData = {
      ...this.sisData,
      gpa_integrated_at: new Date().toISOString(),
      courses: this.sisData.courses.map(sisCourse => {
        const enhancedSections = sisCourse.sections.map(section => {
          const matchingGPA = this.findMatchingInstructor(
            section.teacherName, 
            sisCourse.mnemonic, 
            sisCourse.number
          );
          
          return {
            ...section,
            instructorGPA: matchingGPA ? matchingGPA.gpa : 'N/A',
            instructorRating: matchingGPA ? matchingGPA.rating : 'N/A',
            instructorDifficulty: matchingGPA ? matchingGPA.difficulty : 'N/A',
            lastTaught: matchingGPA ? matchingGPA.lastTaught : 'N/A'
          };
        });

        const enhancedDiscussions = sisCourse.discussions.map(discussion => {
          // Discussions don't need GPA data - keep them simple
          return {
            ...discussion
          };
        });

        return {
          ...sisCourse,
          sections: enhancedSections,
          discussions: enhancedDiscussions
        };
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
    if (!this.integratedData) return;

    const totalSections = this.integratedData.courses.reduce((sum, course) => 
      sum + course.sections.length, 0);
    const totalDiscussions = this.integratedData.courses.reduce((sum, course) => 
      sum + course.discussions.length, 0);
    
    const sectionsWithGPA = this.integratedData.courses.reduce((sum, course) => 
      sum + course.sections.filter(s => s.instructorGPA !== 'N/A').length, 0);

    console.log('\n📊 Integration Summary:');
    console.log(`   Total sections: ${totalSections}`);
    console.log(`   Sections with GPA: ${sectionsWithGPA} (${((sectionsWithGPA/totalSections)*100).toFixed(1)}%)`);
    console.log(`   Total discussions: ${totalDiscussions} (no GPA data needed)`);
    
    // Show some examples
    console.log('\n📝 Sample integrated data:');
    this.integratedData.courses.slice(0, 3).forEach(course => {
      console.log(`   ${course.mnemonic} ${course.number}:`);
      course.sections.slice(0, 2).forEach(section => {
        console.log(`     Section ${section.sectionNumber} (${section.teacherName}): GPA ${section.instructorGPA}`);
      });
    });
  }

  // Main integration process
  async run() {
    console.log('🚀 Starting GPA data integration...\n');
    
    if (!this.loadGPAData()) return;
    if (!this.loadSISData()) return;
    if (!this.integrateData()) return;
    if (!this.saveIntegratedData()) return;
    
    this.generateSummary();
    
    console.log('\n🎉 GPA data integration completed successfully!');
  }
}

// Run the integration
if (require.main === module) {
  if (process.argv.length < 3) {
    console.log('❌ Usage: node scripts/integrateGPAData.js <DEPARTMENT> [TERM] [PAGE]');
    console.log('   Example: node scripts/integrateGPAData.js MATH 1258 1');
    console.log('   Example: node scripts/integrateGPAData.js CS 1258 1');
    console.log('   Example: node scripts/integrateGPAData.js MATH (uses defaults: term=1258, page=1)');
    process.exit(1);
  }
  
  const integrator = new GPADataIntegrator();
  integrator.run().catch(console.error);
}

module.exports = GPADataIntegrator; 