const fs = require('fs');
const path = require('path');

class MasterGPAManager {
  constructor() {
    this.masterCSVPath = path.join(__dirname, '../data/master-gpa-data.csv');
    this.masterData = [];
  }

  // Load existing master CSV data
  loadMasterData() {
    try {
      if (fs.existsSync(this.masterCSVPath)) {
        const csvContent = fs.readFileSync(this.masterCSVPath, 'utf8');
        const lines = csvContent.trim().split('\n');
        const headers = lines[0].split(',');
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          const row = {};
          headers.forEach((header, index) => {
            row[header.trim()] = values[index] ? values[index].trim() : '';
          });
          this.masterData.push(row);
        }
        console.log(`📊 Loaded ${this.masterData.length} existing GPA records from master CSV`);
      } else {
        console.log('📊 Creating new master CSV file');
        this.masterData = [];
      }
      return true;
    } catch (error) {
      console.error('❌ Error loading master CSV:', error.message);
      return false;
    }
  }

  // Load new department GPA data from JSON
  loadDepartmentData(department) {
    try {
      const jsonPath = path.join(__dirname, `../data/courseforum-${department.toLowerCase()}-gpa-data.json`);
      if (!fs.existsSync(jsonPath)) {
        console.error(`❌ Department data file not found: ${jsonPath}`);
        return false;
      }

      const departmentData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      console.log(`📚 Loaded ${departmentData.fall_2025_courses.length} courses from ${department} department`);
      return departmentData;
    } catch (error) {
      console.error('❌ Error loading department data:', error.message);
      return false;
    }
  }

  // Convert department data to CSV format
  convertToCSVFormat(departmentData, department) {
    const csvRecords = [];
    
    departmentData.fall_2025_courses.forEach(course => {
      if (course.instructors && course.instructors.length > 0) {
        course.instructors.forEach(instructor => {
          // Extract course number from courseId (e.g., "MATH 1140" -> "1140")
          const courseNumber = course.courseId.split(' ')[1];
          
          csvRecords.push({
            department: department,
            courseMnemonic: department,
            courseNumber: courseNumber,
            profFullName: instructor.name,
            gpa: instructor.gpa,
            rating: instructor.rating,
            difficulty: instructor.difficulty,
            lastTaught: instructor.lastTaught,
            courseTitle: course.title,
            scrapedAt: new Date().toISOString()
          });
        });
      }
    });
    
    return csvRecords;
  }

  // Update master CSV with new department data
  updateMasterCSV(newRecords, department) {
    console.log(`🔄 Updating master CSV with ${newRecords.length} new records from ${department}...`);
    
    // Remove existing records for this department to avoid duplicates
    this.masterData = this.masterData.filter(record => record.department !== department);
    
    // Add new records
    this.masterData = this.masterData.concat(newRecords);
    
    console.log(`✅ Master CSV now contains ${this.masterData.length} total records`);
  }

  // Save updated master CSV
  saveMasterCSV() {
    try {
      if (this.masterData.length === 0) {
        console.log('⚠️ No data to save');
        return false;
      }

      // Define CSV headers
      const headers = [
        'department', 'courseMnemonic', 'courseNumber', 'profFullName', 
        'gpa', 'rating', 'difficulty', 'lastTaught', 'courseTitle', 'scrapedAt'
      ];

      // Create CSV content
      let csvContent = headers.join(',') + '\n';
      
      this.masterData.forEach(record => {
        const row = headers.map(header => {
          const value = record[header] || '';
          // Escape commas and quotes in CSV values
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csvContent += row.join(',') + '\n';
      });

      // Ensure data directory exists
      const dataDir = path.dirname(this.masterCSVPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(this.masterCSVPath, csvContent);
      console.log(`💾 Master CSV saved to: ${this.masterCSVPath}`);
      return true;
    } catch (error) {
      console.error('❌ Error saving master CSV:', error.message);
      return false;
    }
  }

  // Generate summary statistics
  generateSummary() {
    if (this.masterData.length === 0) return;

    const departments = [...new Set(this.masterData.map(r => r.department))];
    const totalRecords = this.masterData.length;
    
    console.log('\n📊 Master GPA Data Summary:');
    console.log(`   Total records: ${totalRecords}`);
    console.log(`   Departments: ${departments.join(', ')}`);
    
    departments.forEach(dept => {
      const deptRecords = this.masterData.filter(r => r.department === dept);
      const uniqueCourses = [...new Set(deptRecords.map(r => `${r.courseMnemonic} ${r.courseNumber}`))];
      const uniqueInstructors = [...new Set(deptRecords.map(r => r.profFullName))];
      
      console.log(`   ${dept}: ${deptRecords.length} records, ${uniqueCourses.length} courses, ${uniqueInstructors.length} instructors`);
    });
  }

  // Main process for updating master CSV
  async updateDepartment(department) {
    console.log(`🚀 Starting update for ${department} department...\n`);
    
    if (!this.loadMasterData()) return false;
    
    const departmentData = this.loadDepartmentData(department);
    if (!departmentData) return false;
    
    const newRecords = this.convertToCSVFormat(departmentData, department);
    if (newRecords.length === 0) {
      console.log(`⚠️ No instructor data found for ${department} department`);
      return false;
    }
    
    this.updateMasterCSV(newRecords, department);
    
    if (!this.saveMasterCSV()) return false;
    
    this.generateSummary();
    
    console.log(`\n🎉 Successfully updated master CSV with ${department} data!`);
    return true;
  }
}

// Command line interface
async function main() {
  const department = process.argv[2];
  
  if (!department) {
    console.log('❌ Usage: node scripts/updateMasterGPACSV.js <DEPARTMENT>');
    console.log('   Example: node scripts/updateMasterGPACSV.js MATH');
    console.log('   Example: node scripts/updateMasterGPACSV.js CS');
    process.exit(1);
  }

  const manager = new MasterGPAManager();
  const success = await manager.updateDepartment(department.toUpperCase());
  
  if (!success) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = MasterGPAManager; 