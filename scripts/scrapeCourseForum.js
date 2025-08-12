const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class CourseForumScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.courses = [];
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
      console.log('🚀 Starting to scrape theCourseForum CS department...');
      
      // Navigate to the CS department page
      await this.page.goto('https://thecourseforum.com/department/31/', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for the page to fully load
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('📚 Page loaded, extracting course data...');

      // Extract course data from the page content
      const courseData = await this.page.evaluate(() => {
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
            lastTaught,
            instructors: [] // Will be populated later if we can access individual course pages
          });
        }
        
        return courses;
      });

      this.courses = courseData;
      console.log(`✅ Extracted ${this.courses.length} courses from main page`);

      // Filter for Fall 2025 courses
      const fall2025Courses = this.courses.filter(course => 
        course.lastTaught === 'Fall 2025'
      );

      console.log(`\n📊 Found ${fall2025Courses.length} courses taught in Fall 2025`);

      // Try to get more detailed instructor data by clicking on course links
      console.log('\n🔍 Attempting to get detailed instructor data...');
      
      for (let i = 0; i < Math.min(fall2025Courses.length, 5); i++) { // Limit to first 5 for testing
        try {
          const course = fall2025Courses[i];
          const instructorData = await this.getCourseInstructorData(course);
          if (instructorData) {
            course.instructors = instructorData;
            console.log(`✅ Got instructor data for ${course.courseId}`);
          }
        } catch (error) {
          console.error(`❌ Error getting instructor data for ${fall2025Courses[i].courseId}:`, error.message);
        }
      }

      // Save the scraped data
      const outputPath = path.join(__dirname, '..', 'data', 'courseforum-gpa-data.json');
      const outputData = {
        scraped_at: new Date().toISOString(),
        total_courses: this.courses.length,
        fall_2025_courses: fall2025Courses.length,
        courses: fall2025Courses
      };

      fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
      console.log(`💾 Saved GPA data to: ${outputPath}`);

      return fall2025Courses;

    } catch (error) {
      console.error('❌ Error scraping CS department:', error);
      throw error;
    }
  }

  async getCourseInstructorData(course) {
    try {
      // Look for course links - they might be in the text or have specific patterns
      const courseLinks = await this.page.$$('a');
      let courseLink = null;
      
      // Try to find a link that contains the course ID
      for (const link of courseLinks) {
        const linkText = await this.page.evaluate(el => el.textContent?.trim(), link);
        if (linkText && linkText.includes(course.courseId.split(' ')[1])) {
          courseLink = link;
          break;
        }
      }

      if (!courseLink) {
        console.log(`⚠️ No link found for ${course.courseId}`);
        return null;
      }

      // Click the course link to open detailed view
      await courseLink.click();
      
      // Wait for the detailed view to load
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Extract instructor data from the detailed view
      const instructorData = await this.page.evaluate(() => {
        const instructors = [];
        const textContent = document.body.innerText;
        
        // Look for instructor patterns in the detailed view
        // This is a simplified approach - we'll need to refine based on actual page structure
        const instructorPattern = /([A-Z][a-z]+ [A-Z][a-z]+)\s*\n\s*([\d.]+)\s*\n\s*([\d.]+)\s*\n\s*([\d.]+)/g;
        
        let match;
        while ((match = instructorPattern.exec(textContent)) !== null) {
          instructors.push({
            name: match[1],
            rating: match[2],
            difficulty: match[3],
            gpa: match[4],
            lastTaught: 'Fall 2025' // Assume Fall 2025 for now
          });
        }
        
        return instructors;
      });

      // Go back to the main page
      await this.page.goBack();
      await new Promise(resolve => setTimeout(resolve, 2000));

      return instructorData;

    } catch (error) {
      console.error(`Error getting instructor data for ${course.courseId}:`, error);
      return null;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

async function main() {
  const scraper = new CourseForumScraper();
  
  try {
    await scraper.initialize();
    const fall2025Courses = await scraper.scrapeCSDepartment();
    
    console.log('\n🎉 Scraping completed successfully!');
    console.log(`📚 Total courses found: ${fall2025Courses.length}`);
    
    // Display summary of Fall 2025 courses
    fall2025Courses.forEach(course => {
      console.log(`\n${course.courseId}: ${course.title}`);
      console.log(`  Overall GPA: ${course.overallGPA}, Rating: ${course.overallRating}, Difficulty: ${course.overallDifficulty}`);
      console.log(`  Last Taught: ${course.lastTaught}`);
      
      if (course.instructors && course.instructors.length > 0) {
        course.instructors.forEach(instructor => {
          console.log(`    👨‍🏫 ${instructor.name}: GPA ${instructor.gpa}, Rating ${instructor.rating}`);
        });
      }
    });

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