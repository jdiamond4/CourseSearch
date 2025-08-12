const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class InstructorGPAScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.instructorData = [];
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

  async scrapeCSDepartment() {
    try {
      console.log('🚀 Starting to scrape instructor GPA data from theCourseForum CS department...');
      
      let allCourses = [];
      let currentPage = 1;
      let hasMorePages = true;

      // Scrape all pages
      while (hasMorePages) {
        console.log(`\n📄 Scraping page ${currentPage}...`);
        
        // Navigate to the specific page
        const pageUrl = `https://thecourseforum.com/department/31/?page=${currentPage}`;
        await this.page.goto(pageUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait for the page to fully load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Extract course listings from this page
        const pageCourses = await this.page.evaluate(() => {
          const courses = [];
          const textContent = document.body.innerText;
          
          // Split by course patterns - look for "CS XXXX" followed by course info
          const coursePattern = /CS\s+(\d{4})\s*\n([^\n]+)\s*\n\s*RATING\s*\n\s*([\d.]+)\s*\n\s*DIFFICULTY\s*\n\s*([\d.]+)\s*\n\s*GPA\s*\n\s*([\d.]+)\s*\n\s*LAST TAUGHT\s*\n\s*([^\n]+)/g;
          
          let match;
          while ((match = coursePattern.exec(textContent)) !== null) {
            const courseId = match[1];
            const title = match[2].trim();
            const rating = match[3];
            const difficulty = match[4];
            const gpa = match[5];
            const lastTaught = match[6].trim();
            
            courses.push({
              courseId: `CS ${courseId}`,
              title,
              overallRating: rating,
              overallDifficulty: difficulty,
              overallGPA: gpa,
              lastTaught
            });
          }
          
          return courses;
        });

        if (pageCourses.length === 0) {
          console.log(`  ⚠️ No courses found on page ${currentPage}, stopping pagination`);
          hasMorePages = false;
        } else {
          console.log(`  ✅ Found ${pageCourses.length} courses on page ${currentPage}`);
          allCourses.push(...pageCourses);
          
          // Check if there's a next page
          const hasNextPage = await this.page.evaluate(() => {
            // Look for pagination controls and check if there's a next page
            const nextButton = document.querySelector('a[href*="page="]') || 
                              document.querySelector('a:contains(">")') ||
                              document.querySelector('a:contains("Next")');
            return !!nextButton;
          });
          
          if (!hasNextPage) {
            console.log(`  📄 No next page found, stopping pagination`);
            hasMorePages = false;
          } else {
            currentPage++;
            // Small delay between pages
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      console.log(`\n📚 Total courses found across all pages: ${allCourses.length}`);
      console.log('Now getting instructor data for each course...');

      // Now click into each course to get instructor-specific data
      for (let i = 0; i < allCourses.length; i++) {
        const course = allCourses[i];
        try {
          console.log(`\n🔍 Getting instructor data for ${course.courseId} (${i + 1}/${allCourses.length})`);
          
          const instructorData = await this.getCourseInstructorData(course);
          if (instructorData && instructorData.length > 0) {
            // Add course context to each instructor record
            instructorData.forEach(instructor => {
              this.instructorData.push({
                courseMnemonic: 'CS',
                courseNumber: course.courseId.split(' ')[1],
                courseTitle: course.title,
                profFullName: instructor.name,
                gpa: instructor.gpa,
                rating: instructor.rating,
                difficulty: instructor.difficulty,
                lastTaught: instructor.lastTaught || course.lastTaught,
                overallCourseGPA: course.overallGPA,
                overallCourseRating: course.overallRating,
                overallCourseDifficulty: course.overallDifficulty
              });
            });
            
            console.log(`  ✅ Found ${instructorData.length} instructors`);
          } else {
            console.log(`  ⚠️ No instructor data found`);
          }
          
          // Small delay to be respectful to the server
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`❌ Error getting instructor data for ${course.courseId}:`, error.message);
        }
      }

      console.log(`\n📊 Scraping completed! Found ${this.instructorData.length} instructor records`);

      // Save to CSV
      const csvPath = path.join(__dirname, '..', 'data', 'instructor-gpa-data.csv');
      this.saveToCSV(csvPath);
      
      // Also save as JSON for reference
      const jsonPath = path.join(__dirname, '..', 'data', 'instructor-gpa-data.json');
      this.saveToJSON(jsonPath);

      return this.instructorData;

    } catch (error) {
      console.error('❌ Error scraping CS department:', error);
      throw error;
    }
  }

  async getCourseInstructorData(course) {
    try {
      // Direct navigation approach - construct the course URL directly
      const courseNumber = course.courseId.split(' ')[1];
      const courseUrl = `https://thecourseforum.com/course/CS/${courseNumber}/`;
      
      console.log(`    🔗 Navigating directly to: ${courseUrl}`);
      
      // Navigate directly to the course page
      await this.page.goto(courseUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Wait for the page to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Extract instructor data from the detailed view
      const instructorData = await this.page.evaluate(() => {
        const instructors = [];
        
        // Look for instructor cards - each instructor has a rating-card-link
        const instructorCards = document.querySelectorAll('a.rating-card-link');
        
        instructorCards.forEach(card => {
          try {
            // Get instructor name from the h3 title
            const nameElement = card.querySelector('h3#title');
            if (!nameElement) return;
            
            const name = nameElement.textContent.trim();
            
            // Find the parent row that contains both the link and the stats
            const parentRow = card.closest('.row.no-gutters');
            if (!parentRow) return;
            
            // Extract stats from the info elements
            const ratingElement = parentRow.querySelector('#rating');
            const difficultyElement = parentRow.querySelector('#difficulty');
            const gpaElement = parentRow.querySelector('#gpa');
            const sectionsElement = parentRow.querySelector('#times');
            const lastTaughtElement = parentRow.querySelector('#recency');
            
            const rating = ratingElement ? ratingElement.textContent.trim() : 'N/A';
            const difficulty = difficultyElement ? difficultyElement.textContent.trim() : 'N/A';
            const gpa = gpaElement ? gpaElement.textContent.trim() : 'N/A';
            const sections = sectionsElement ? sectionsElement.textContent.trim() : 'N/A';
            const lastTaught = lastTaughtElement ? lastTaughtElement.textContent.trim() : 'N/A';
            
            instructors.push({
              name: name,
              rating: rating,
              difficulty: difficulty,
              gpa: gpa,
              sections: sections,
              lastTaught: lastTaught
            });
            
          } catch (error) {
            console.error('Error parsing instructor card:', error);
          }
        });
        
        return instructors;
      });

      console.log(`    📊 Found ${instructorData.length} instructors on course page`);
      
      // Go back to the main department page to continue with next course
      await this.page.goto(`https://thecourseforum.com/department/31/?page=1`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Wait for the page to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      return instructorData;

    } catch (error) {
      console.error(`    Error getting instructor data for ${course.courseId}:`, error);
      
      // If there's an error, try to go back to the main page
      try {
        await this.page.goto(`https://thecourseforum.com/department/31/?page=1`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (navError) {
        console.error(`    Error navigating back to main page:`, navError);
      }
      
      return null;
    }
  }

  saveToCSV(filePath) {
    if (this.instructorData.length === 0) {
      console.log('⚠️ No data to save to CSV');
      return;
    }

    // Create CSV header
    const headers = [
      'courseMnemonic',
      'courseNumber', 
      'courseTitle',
      'profFullName',
      'gpa',
      'rating',
      'difficulty',
      'lastTaught',
      'overallCourseGPA',
      'overallCourseRating',
      'overallCourseDifficulty'
    ];

    // Create CSV content
    let csvContent = headers.join(',') + '\n';
    
    this.instructorData.forEach(record => {
      const row = headers.map(header => {
        const value = record[header] || '';
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      csvContent += row.join(',') + '\n';
    });

    fs.writeFileSync(filePath, csvContent);
    console.log(`💾 CSV data saved to: ${filePath}`);
  }

  saveToJSON(filePath) {
    if (this.instructorData.length === 0) {
      console.log('⚠️ No data to save to JSON');
      return;
    }

    const outputData = {
      scraped_at: new Date().toISOString(),
      department: 'CS',
      total_instructors: this.instructorData.length,
      data: this.instructorData
    };

    fs.writeFileSync(filePath, JSON.stringify(outputData, null, 2));
    console.log(`💾 JSON data saved to: ${filePath}`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

async function main() {
  const scraper = new InstructorGPAScraper();
  
  try {
    await scraper.initialize();
    const instructorData = await scraper.scrapeCSDepartment();
    
    console.log('\n🎉 Scraping completed successfully!');
    console.log(`📚 Total instructor records: ${instructorData.length}`);
    
    // Display summary
    if (instructorData.length > 0) {
      console.log('\n📊 Sample data:');
      instructorData.slice(0, 5).forEach(record => {
        console.log(`  ${record.courseMnemonic} ${record.courseNumber}: ${record.profFullName} - GPA: ${record.gpa}`);
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

module.exports = { InstructorGPAScraper }; 