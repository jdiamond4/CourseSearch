const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Command line argument parsing
function getArg(name, defaultValue = undefined) {
  // First try --key=value format
  const equalsPattern = new RegExp(`--${name}=(.+)`);
  for (let i = 0; i < process.argv.length; i++) {
    const match = process.argv[i].match(equalsPattern);
    if (match) {
      return match[1];
    }
  }
  
  // Then try --key value format
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  
  return defaultValue;
}

class CourseForumScraper {
  constructor(departmentId, subject, term = null) {
    this.browser = null;
    this.page = null;
    this.courses = [];
    this.departmentId = departmentId;
    this.subject = subject;
    this.term = term;
    this.masterCSVPath = path.join(__dirname, '..', 'data', 'master-gpa-data.csv');
  }

  async initialize() {
    this.browser = await puppeteer.launch({ 
      headless: false, // Set to true in production
      defaultViewport: null,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    
    // Set user agent to avoid detection
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  }

  // Load SIS data to get course numbers for this semester
  async loadSISData() {
    try {
      console.log(`🔍 Fetching fresh SIS data for ${this.subject} department...`);
      
      // Import the SIS fetching logic directly
      const { chromium } = require('playwright');
      
      let allCourseNumbers = new Set();
      let page = 1;
      let hasMoreData = true;
      
      while (hasMoreData && page <= 20) { // Safety limit of 20 pages
        try {
          console.log(`📄 Fetching page ${page}...`);
          
          // Build the SIS URL directly
          const base = 'https://sisuva.admin.virginia.edu/psc/ihprd/UVSS/SA/s/WEBLIB_HCX_CM.H_CLASS_SEARCH.FieldFormula.IScript_ClassSearch';
          const params = new URLSearchParams({
            institution: 'UVA01',
            term: this.term,
            subject: this.subject,
            page: String(page)
          });
          const url = `${base}?${params.toString()}`;
          
          // Fetch the data
          const browser = await chromium.launch({ headless: true });
          const context = await browser.newContext();
          const pageObj = await context.newPage();
          
          try {
            const response = await pageObj.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            if (!response) {
              throw new Error('No response received');
            }
            const status = response.status();
            if (status < 200 || status >= 300) {
              throw new Error(`HTTP ${status}`);
            }
            
            const body = await response.text();
            let json;
            try {
              json = JSON.parse(body);
            } catch (e) {
              throw new Error('Failed to parse JSON from response');
            }
            
            const classes = Array.isArray(json?.classes) ? json.classes : Array.isArray(json) ? json : [];
            
            if (classes.length > 0) {
              // Extract course numbers from this page
              classes.forEach(course => {
                if (course.subject === this.subject && course.catalog_nbr) {
                  allCourseNumbers.add(parseInt(course.catalog_nbr));
                }
              });
              
              console.log(`  ✅ Page ${page}: Found ${classes.length} classes, ${allCourseNumbers.size} unique courses so far`);
              page++;
            } else {
              console.log(`  ⚠️ Page ${page}: No more data, stopping`);
              hasMoreData = false;
            }
            
          } finally {
            await browser.close();
          }
          
          // Small delay between pages
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.log(`⚠️ Error on page ${page}, stopping: ${error.message}`);
          hasMoreData = false;
        }
      }
      
      // Convert Set to sorted array
      const courseNumbers = Array.from(allCourseNumbers).sort((a, b) => a - b);
      
      console.log(`🔢 Found ${courseNumbers.length} unique course numbers: ${courseNumbers.join(', ')}`);
      
      return courseNumbers;
    } catch (error) {
      console.error('❌ Error loading SIS data:', error.message);
      return false;
    }
  }

  // Scrape instructor data from a specific course page
  async scrapeCoursePage(courseNumber) {
    try {
      // Use /all at the end of URL to show all semesters (faster than clicking button)
      const courseUrl = `https://thecourseforum.com/course/${this.subject}/${courseNumber}/all`;
      console.log(`📖 Scraping ${this.subject} ${courseNumber}: ${courseUrl}`);
      
      await this.page.goto(courseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Wait for the page to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Extract instructor data from this course page
      const instructorData = await this.page.evaluate(() => {
        const instructors = [];
        
        // Find all instructor cards
        const instructorCards = document.querySelectorAll('.row.no-gutters');
        
        instructorCards.forEach(card => {
          try {
            // Get instructor name from the h3 title
            const nameElement = card.querySelector('h3#title');
            if (!nameElement) return;
            
            const name = nameElement.textContent.trim();
            
            // Extract stats from the info elements
            const ratingElement = card.querySelector('#rating');
            const difficultyElement = card.querySelector('#difficulty');
            const gpaElement = card.querySelector('#gpa');
            const sectionsElement = card.querySelector('#times');
            const lastTaughtElement = card.querySelector('#recency');
            
            const rating = ratingElement ? ratingElement.textContent.trim() : 'N/A';
            const difficulty = difficultyElement ? difficultyElement.textContent.trim() : 'N/A';
            const gpa = gpaElement ? gpaElement.textContent.trim() : 'N/A';
            const sections = sectionsElement ? sectionsElement.textContent.trim() : 'N/A';
            const lastTaught = lastTaughtElement ? lastTaughtElement.textContent.trim() : 'N/A';
            
            // Include instructors who taught in recent semesters (Fall 2024, Spring 2025, Summer 2025, Fall 2025, Spring 2026)
            const recentSemesters = ['Fall 2024', 'Spring 2025', 'Summer 2025', 'Fall 2025', 'Spring 2026'];
            if (recentSemesters.includes(lastTaught)) {
              instructors.push({
                name,
                rating,
                difficulty,
                gpa,
                sections,
                lastTaught
              });
            }
            
          } catch (error) {
            console.log('Error parsing instructor card:', error);
          }
        });
        
        return instructors;
      });

      if (instructorData && instructorData.length > 0) {
        console.log(`✅ Found ${instructorData.length} instructors for ${this.subject} ${courseNumber} (recent semesters)`);
        
        // Add course context to each instructor record
        instructorData.forEach(instructor => {
          this.courses.push({
            department: this.subject,
            courseNumber: courseNumber.toString(),
            courseTitle: `Course ${courseNumber}`, // We'll get the actual title from SIS data later
            instructorName: instructor.name,
            instructorGPA: instructor.gpa,
            instructorRating: instructor.rating,
            instructorDifficulty: instructor.difficulty,
            instructorLastTaught: instructor.lastTaught,
            sections: instructor.sections,
            scrapedAt: new Date().toISOString()
          });
        });
      } else {
        console.log(`⚠️ No recent instructors found for ${this.subject} ${courseNumber}`);
      }
      
      return instructorData;

    } catch (error) {
      console.error(`❌ Error scraping ${this.subject} ${courseNumber}:`, error.message);
      return null;
    }
  }

  // Main scraping process
  async scrapeDepartment() {
    try {
      console.log(`🚀 Starting to scrape theCourseForum ${this.subject} department...`);
      console.log(`📍 Department ID: ${this.departmentId}, Subject: ${this.subject}, Term: ${this.term}`);
      
      // Load SIS data to get course numbers
      const courseNumbers = await this.loadSISData();
      if (!courseNumbers) {
        throw new Error('Failed to load SIS data');
      }
      
      console.log(`\n🔍 Scraping instructor data for ${courseNumbers.length} courses...`);
      
      // Scrape each course page
      for (let i = 0; i < courseNumbers.length; i++) {
        const courseNumber = courseNumbers[i];
        
        try {
          await this.scrapeCoursePage(courseNumber);
          
          // Small delay to be respectful to the server
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`❌ Error processing ${this.subject} ${courseNumber}:`, error.message);
        }
      }

      console.log(`\n📊 Scraping completed! Found ${this.courses.length} instructor records for Fall 2025`);

      // Update master CSV with new data
      await this.updateMasterCSV();

      return this.courses;

    } catch (error) {
      console.error('❌ Scraping failed:', error);
      throw error;
    }
  }

  // Load existing master CSV data
  loadMasterCSV() {
    try {
      if (fs.existsSync(this.masterCSVPath)) {
        const csvContent = fs.readFileSync(this.masterCSVPath, 'utf8');
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
        
        console.log(`📊 Loaded ${data.length} existing GPA records from master CSV`);
        return data;
      } else {
        console.log('📊 Creating new master CSV file');
        return [];
      }
    } catch (error) {
      console.error('❌ Error loading master CSV:', error.message);
      return [];
    }
  }

  // Update master CSV with new department data
  async updateMasterCSV() {
    console.log(`🔄 Updating master CSV with ${this.subject} department data...`);
    
    // Load existing data
    const existingData = this.loadMasterCSV();
    
    // Remove old data for this department
    const filteredData = existingData.filter(record => record.department !== this.subject);
    
    // Convert new data to CSV format
    const newRecords = this.courses.map(course => ({
      department: course.department,
      courseNumber: course.courseNumber,
      courseTitle: course.courseTitle,
      instructorName: course.instructorName,
      instructorGPA: course.instructorGPA,
      instructorRating: course.instructorRating,
      instructorDifficulty: course.instructorDifficulty,
      instructorLastTaught: course.instructorLastTaught,
      sections: course.sections,
      scrapedAt: course.scrapedAt
    }));
    
    // Combine old and new data
    const allData = [...filteredData, ...newRecords];
    
    // Save updated master CSV
    if (this.saveMasterCSV(allData)) {
      console.log(`✅ Master CSV updated with ${newRecords.length} new records from ${this.subject}`);
      console.log(`📊 Master CSV now contains ${allData.length} total records`);
    }
  }

  // Save master CSV
  saveMasterCSV(data) {
    try {
      // Define CSV headers
      const headers = [
        'department',
        'courseNumber',
        'courseTitle',
        'instructorName',
        'instructorGPA',
        'instructorRating',
        'instructorDifficulty',
        'instructorLastTaught',
        'sections',
        'scrapedAt'
      ];

      // Create CSV content
      let csvContent = headers.join(',') + '\n';
      
      data.forEach(record => {
        const row = headers.map(header => {
          const value = record[header] || '';
          // Escape commas and quotes in CSV values
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
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

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Load departments from CSV
function loadDepartments() {
  try {
    const departmentsPath = path.join(__dirname, '..', 'localdata', 'departments.csv');
    if (!fs.existsSync(departmentsPath)) {
      console.error('❌ departments.csv not found');
      return [];
    }

    const csvContent = fs.readFileSync(departmentsPath, 'utf8');
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');
    
    const idIndex = headers.indexOf('id');
    const nemonicIndex = headers.indexOf('nemonic');
    
    const departments = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const id = values[idIndex]?.trim();
      const nemonic = values[nemonicIndex]?.trim();
      
      if (id && nemonic && nemonic !== 'none') {
        departments.push({ id, nemonic });
      }
    }

    return departments;
  } catch (error) {
    console.error('❌ Error loading departments:', error.message);
    return [];
  }
}

// Scrape all departments (or a range)
async function scrapeAllDepartments(term, rangeStart = null, rangeEnd = null) {
  const allDepartments = loadDepartments();
  
  // Apply range if specified
  let departments = allDepartments;
  if (rangeStart !== null && rangeEnd !== null) {
    const start = Math.max(0, rangeStart - 1); // Convert to 0-indexed
    const end = Math.min(allDepartments.length, rangeEnd);
    departments = allDepartments.slice(start, end);
    console.log(`\n📋 Processing departments ${rangeStart}-${rangeEnd} (of ${allDepartments.length} total)`);
  } else {
    console.log(`\n📋 Found ${departments.length} departments to scrape`);
  }
  
  console.log(`📦 Departments to process: ${departments.map(d => d.nemonic).join(', ')}\n`);
  
  let totalRecords = 0;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < departments.length; i++) {
    const dept = departments[i];
    const actualIndex = rangeStart ? (rangeStart + i) : (i + 1);
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📚 [${actualIndex}/${allDepartments.length}] Scraping ${dept.nemonic} (ID: ${dept.id})`);
    console.log('='.repeat(80));

    const scraper = new CourseForumScraper(dept.id, dept.nemonic, term);
    
    try {
      await scraper.initialize();
      const courses = await scraper.scrapeDepartment();
      
      console.log(`✅ ${dept.nemonic} complete: ${courses.length} instructor records`);
      totalRecords += courses.length;
      successCount++;
      
      await scraper.close();
      
      // Small delay between departments to avoid rate limiting
      if (i < departments.length - 1) {
        console.log('⏱️  Waiting 3 seconds before next department...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
    } catch (error) {
      console.error(`❌ ${dept.nemonic} failed:`, error.message);
      failCount++;
      await scraper.close();
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Departments: ${departments.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total Instructor Records: ${totalRecords}`);
  console.log('='.repeat(80) + '\n');
}

async function main() {
  const departmentId = getArg('departmentId', '31'); // Default to CS department ID
  const subject = getArg('subject', 'CS'); // Default to CS
  const term = getArg('term', '1262'); // Default to Spring 2026
  const all = process.argv.includes('--all');
  const rangeArg = getArg('range', null);

  // Parse range argument (e.g., --range=1-10)
  let rangeStart = null;
  let rangeEnd = null;
  if (rangeArg) {
    const rangeParts = rangeArg.split('-');
    if (rangeParts.length === 2) {
      rangeStart = parseInt(rangeParts[0]);
      rangeEnd = parseInt(rangeParts[1]);
      if (isNaN(rangeStart) || isNaN(rangeEnd)) {
        console.error('❌ Invalid range format. Use: --range=1-10');
        return;
      }
    } else {
      console.error('❌ Invalid range format. Use: --range=1-10');
      return;
    }
  }

  if (all || rangeArg) {
    if (rangeArg) {
      console.log(`🚀 Scraping GPA data for departments ${rangeStart}-${rangeEnd}`);
    } else {
      console.log('🚀 Scraping GPA data for ALL departments');
    }
    console.log(`📅 Term: ${term}`);
    await scrapeAllDepartments(term, rangeStart, rangeEnd);
    return;
  }

  console.log(`🔧 Parsed arguments:`);
  console.log(`   Department ID: ${departmentId}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Term: ${term}`);
  console.log(`   Full command: ${process.argv.join(' ')}`);

  const scraper = new CourseForumScraper(departmentId, subject, term);
  
  try {
    await scraper.initialize();
    const courses = await scraper.scrapeDepartment();
    
    console.log('\n🎉 Scraping completed successfully!');
    console.log(`📚 Total instructor records found: ${courses.length}`);
    
    // Display summary
    if (courses.length > 0) {
      console.log('\n📊 Sample data:');
      courses.slice(0, 5).forEach(record => {
        console.log(`  ${record.department} ${record.courseNumber}: ${record.instructorName} - GPA: ${record.instructorGPA}, Rating: ${record.instructorRating}`);
      });
    }

  } catch (error) {
    console.error('❌ Scraping failed:', error);
  } finally {
    await scraper.close();
  }
}

// Run the scraper if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = { CourseForumScraper }; 