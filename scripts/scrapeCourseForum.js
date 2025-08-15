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
  constructor(departmentId, subject) {
    this.browser = null;
    this.page = null;
    this.courses = [];
    this.departmentId = departmentId;
    this.subject = subject;
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

  async scrapeDepartment() {
    try {
      console.log(`🚀 Starting to scrape theCourseForum ${this.subject} department...`);
      console.log(`📍 Department ID: ${this.departmentId}, Subject: ${this.subject}`);
      
      // Navigate to the department page
      const departmentUrl = `https://thecourseforum.com/department/${this.departmentId}/`;
      console.log(`🌐 Navigating to: ${departmentUrl}`);
      
      await this.page.goto(departmentUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for the page to fully load
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verify we're on the right page
      const currentUrl = this.page.url();
      console.log(`✅ Current URL: ${currentUrl}`);
      
      // Check for pagination and get all courses from all pages
      let allCourses = [];
      let currentPage = 1;
      let hasMorePages = true;
      
      while (hasMorePages) {
        console.log(`📄 Processing page ${currentPage}...`);
        
        // Extract course data from the current page
        const pageCourseData = await this.page.evaluate((subject) => {
          const courses = [];
          
          // Get the page text content to find course information
          const textContent = document.body.innerText;
          
          // Look for course patterns with "LAST TAUGHT" information
          const coursePattern = new RegExp(`${subject}\\s+(\\d{4})\\s*\\n([^\\n]+)\\s*\\n\\s*RATING\\s*\\n\\s*([\\d.]+)\\s*\\n\\s*DIFFICULTY\\s*\\n\\s*([\\d.]+)\\s*\\n\\s*GPA\\s*\\n\\s*([\\d.]+)\\s*\\n\\s*LAST TAUGHT\\s*\\n\\s*([^\\n]+)`, 'g');
          
          let match;
          while ((match = coursePattern.exec(textContent)) !== null) {
            const courseId = match[1];
            const title = match[2].trim();
            const rating = match[3];
            const difficulty = match[4];
            const gpa = match[5];
            const lastTaught = match[6].trim();
            
            // Find the corresponding course link for this course
            const courseLinks = document.querySelectorAll('a[href*="/course/"]');
            let courseUrl = null;
            
            courseLinks.forEach(link => {
              const href = link.getAttribute('href');
              const courseMatch = href.match(new RegExp(`/course/${subject}/(\\d{4})/?$`));
              if (courseMatch && courseMatch[1] === courseId) {
                courseUrl = href;
              }
            });
            
            courses.push({
              courseId: `${subject} ${courseId}`,
              title,
              overallRating: rating,
              overallDifficulty: difficulty,
              overallGPA: gpa,
              lastTaught,
              courseUrl: courseUrl,
              instructors: [] // Will be populated later
            });
          }
          
          return courses;
        }, this.subject);
        
        // Debug: Check what we actually got from the page
        console.log(`🔍 Raw page data: Found ${pageCourseData.length} courses`);
        if (pageCourseData.length > 0) {
          console.log(`   First course: ${pageCourseData[0].courseId} - ${pageCourseData[0].title}`);
        }
        
        // If no courses found on this page, stop pagination
        if (pageCourseData.length === 0) {
          console.log(`⚠️ No courses found on page ${currentPage}, stopping pagination`);
          hasMorePages = false;
          break;
        }
        
        allCourses = allCourses.concat(pageCourseData);
        console.log(`✅ Extracted ${pageCourseData.length} courses from page ${currentPage}`);
        
        // Check if there's a next page button and if we should continue
        const nextPageButton = await this.page.$('a[href*="page="]');
        if (nextPageButton && currentPage < 10) { // Limit to 10 pages max to prevent infinite loop
          try {
            await nextPageButton.click();
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for page load
            currentPage++;
          } catch (error) {
            console.log('⚠️ Could not navigate to next page, stopping pagination');
            hasMorePages = false;
          }
        } else {
          if (currentPage >= 10) {
            console.log('⚠️ Reached maximum page limit (10), stopping pagination');
          } else {
            console.log('📄 No more pages found');
          }
          hasMorePages = false;
        }
      }
      
      this.courses = allCourses;
      console.log(`✅ Total courses extracted from all pages: ${this.courses.length}`);
      
      console.log('📚 Page loaded, extracting course data...');

      // Filter for Fall 2025 courses
      const fall2025Courses = this.courses.filter(course => 
        course.lastTaught === 'Fall 2025'
      );

      console.log(`\n📊 Found ${fall2025Courses.length} courses taught in Fall 2025`);

      // Try to get more detailed instructor data by clicking on course links
      console.log('\n🔍 Attempting to get detailed instructor data...');
      
      for (let i = 0; i < fall2025Courses.length; i++) {
        try {
          const course = fall2025Courses[i];
          
          // Navigate to the course page
          const fullUrl = `https://thecourseforum.com${course.courseUrl}`;
          console.log(`📖 Navigating to: ${fullUrl}`);
          
          await this.page.goto(fullUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
          });
          
          // Wait for the page to load
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Extract instructor data from this course page
          const instructorData = await this.page.evaluate(() => {
            const instructors = [];
            
            // Find all instructor rating cards
            const instructorCards = document.querySelectorAll('.rating-card-link');
            
            instructorCards.forEach(card => {
              try {
                const nameElement = card.querySelector('h3#title');
                const name = nameElement ? nameElement.textContent.trim() : 'Unknown';
                
                // Get the parent container to find rating, difficulty, GPA, etc.
                const container = card.closest('.row.no-gutters');
                if (container) {
                  const ratingElement = container.querySelector('#rating');
                  const difficultyElement = container.querySelector('#difficulty');
                  const gpaElement = container.querySelector('#gpa');
                  const lastTaughtElement = container.querySelector('#recency');
                  
                  const rating = ratingElement ? ratingElement.textContent.trim() : 'N/A';
                  const difficulty = difficultyElement ? difficultyElement.textContent.trim() : 'N/A';
                  const gpa = gpaElement ? gpaElement.textContent.trim() : 'N/A';
                  const lastTaught = lastTaughtElement ? lastTaughtElement.textContent.trim() : 'N/A';
                  
                  instructors.push({
                    name,
                    rating,
                    difficulty,
                    gpa,
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
            course.instructors = instructorData;
            console.log(`✅ Got instructor data for ${course.courseId}: ${instructorData.length} instructors`);
          } else {
            console.log(`⚠️ No instructor data found for ${course.courseId}`);
          }
          
          // Go back to the main department page to continue with next course
          await this.page.goBack();
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`❌ Error getting instructor data for ${fall2025Courses[i].courseId}:`, error.message);
          
          // Try to go back to main page even if there was an error
          try {
            await this.page.goBack();
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (goBackError) {
            console.log('⚠️ Could not return to main page, continuing...');
          }
        }
      }

      // Save the scraped data
      const outputPath = path.join(__dirname, '..', 'data', `courseforum-${this.subject.toLowerCase()}-gpa-data.json`);
      const outputData = {
        scraped_at: new Date().toISOString(),
        department: this.subject,
        department_id: this.departmentId,
        total_courses: this.courses.length,
        fall_2025_courses: fall2025Courses
      };

      // Ensure data directory exists
      const dataDir = path.dirname(outputPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
      console.log(`💾 Saved GPA data to: ${outputPath}`);

      return fall2025Courses;

    } catch (error) {
      console.error('❌ Scraping failed:', error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

async function main() {
  const departmentId = getArg('departmentId', '31'); // Default to CS department ID
  const subject = getArg('subject', 'CS'); // Default to CS

  console.log(`🔧 Parsed arguments:`);
  console.log(`   Department ID: ${departmentId}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Full command: ${process.argv.join(' ')}`);

  const scraper = new CourseForumScraper(departmentId, subject);
  
  try {
    await scraper.initialize();
    const fall2025Courses = await scraper.scrapeDepartment();
    
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