const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Helper function for time formatting
app.locals.formatTime = function(time) {
  if (!time || time === 0 || time === '') return 'TBA';
  
  // Handle SIS time format: "13.00.00.000000" or "09.30.00.000000"
  let timeStr = time.toString();
  
  // Extract hours and minutes from the SIS format
  if (timeStr.includes('.')) {
    const parts = timeStr.split('.');
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    
    if (isNaN(hours) || isNaN(minutes)) return 'TBA';
    
    // Format as 12-hour time
    if (hours === 0) return `12:${minutes.toString().padStart(2, '0')} AM`;
    if (hours < 12) return `${hours}:${minutes.toString().padStart(2, '0')} AM`;
    if (hours === 12) return `12:${minutes.toString().padStart(2, '0')} PM`;
    return `${hours - 12}:${minutes.toString().padStart(2, '0')} PM`;
  }
  
  // Fallback for other time formats
  timeStr = timeStr.padStart(4, '0');
  const hours = parseInt(timeStr.substring(0, 2));
  const minutes = timeStr.substring(2, 4);
  
  if (hours === 0) return `12:${minutes} AM`;
  if (hours < 12) return `${hours}:${minutes} AM`;
  if (hours === 12) return `12:${minutes} PM`;
  return `${hours - 12}:${minutes} PM`;
};

// Helper function to parse CSV
async function parseCSV(filePath) {
  try {
    const csvContent = await fs.readFile(filePath, 'utf8');
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }
    return data;
  } catch (error) {
    console.error(`Error parsing CSV ${filePath}:`, error);
    return [];
  }
}

// Helper function to load GPA data
async function loadGPAData() {
  try {
    const gpaPath = path.join(__dirname, 'data', 'master-gpa-data.csv');
    if (await fs.access(gpaPath).then(() => true).catch(() => false)) {
      return await parseCSV(gpaPath);
    }
    return [];
  } catch (error) {
    console.error('Error loading GPA data:', error);
    return [];
  }
}

// Helper function to find matching GPA data for multiple instructors
function findMatchingGPA(gpaData, subject, catalogNbr, instructorNames) {
  // Split instructor names by semicolon and trim whitespace
  const instructors = instructorNames.split(';').map(name => name.trim());
  
  let bestMatch = null;
  let bestGPA = -1;
  
  // Check each instructor
  for (const instructor of instructors) {
    const match = gpaData.find(gpa => 
      gpa.department === subject && 
      gpa.courseNumber.toString() === catalogNbr.toString() && 
      gpa.instructorName === instructor
    );
    
    if (match && match.instructorGPA && match.instructorGPA !== '—' && match.instructorGPA !== 'N/A') {
      const gpa = parseFloat(match.instructorGPA);
      if (!isNaN(gpa) && gpa > bestGPA) {
        bestGPA = gpa;
        bestMatch = match;
      }
    }
  }
  
  return bestMatch;
}

// Helper function to transform SIS data into course objects
function transformSISDataToCourses(sisData, gpaData) {
  const courseMap = new Map();
  
  sisData.forEach(row => {
    const courseKey = `${row.subject} ${row.catalog_nbr}`;
    
    if (!courseMap.has(courseKey)) {
      courseMap.set(courseKey, {
        mnemonic: row.subject,
        number: parseInt(row.catalog_nbr),
        title: row.course_title || 'No title available',
        units: row.units || '',
        sections: [],
        discussions: []
      });
    }
    
    const course = courseMap.get(courseKey);
    
    // Create section object
    const section = {
      sectionNumber: row.class_section || '',
      component: row.component || '',
      sectionType: row.section_type || '',
      status: getEnrollmentStatus(row.enrollment_available, row.enrl_stat),
      currentEnrollment: parseInt(row.enrollment_total) || 0,
      maxEnrollment: parseInt(row.class_capacity) || 0,
      waitlistTotal: parseInt(row.wait_tot) || 0,
      waitlistCapacity: parseInt(row.wait_cap) || 0,
      teacherName: row.instructor_names || 'TBA',
      startTime: row.start_times || '',
      endTime: row.end_times || '',
      days: row.meeting_days || '',
      building: row.buildings || '',
      room: row.rooms || '',
      location: row.facilities || '',
      startDate: row.start_date || '',
      endDate: row.end_date || '',
      campus: row.campus_descr || '',
      instructionMode: row.instruction_mode_descr || '',
      gradingBasis: row.grading_basis || '',
      courseAttributes: row.course_attributes || '',
      courseAttributeValues: row.course_attribute_values || '',
      requirements: row.rqmnt_designtn || '',
      topic: row.topic || '',
      combinedSection: row.combined_section || '',
      schedulePrint: row.schedule_print || ''
    };
    
    // Try to merge GPA data
    if (row.instructor_names && row.instructor_names !== 'TBA') {
      const gpaMatch = findMatchingGPA(gpaData, row.subject, row.catalog_nbr, row.instructor_names);
      if (gpaMatch) {
        section.instructorGPA = gpaMatch.instructorGPA || 'N/A';
        section.instructorRating = gpaMatch.instructorRating || 'N/A';
        section.instructorDifficulty = gpaMatch.instructorDifficulty || 'N/A';
        section.instructorLastTaught = gpaMatch.instructorLastTaught || 'N/A';
        
        // Log when we find a match for multiple instructors
        if (row.instructor_names.includes(';')) {
          console.log(`✅ Multi-instructor match: ${row.subject} ${row.catalog_nbr} - ${row.instructor_names} → Best: ${gpaMatch.instructorName} (GPA: ${gpaMatch.instructorGPA})`);
        }
      } else {
        section.instructorGPA = 'N/A';
        section.instructorRating = 'N/A';
        section.instructorDifficulty = 'N/A';
        section.instructorLastTaught = 'N/A';
      }
    } else {
      section.instructorGPA = 'N/A';
      section.instructorRating = 'N/A';
      section.instructorDifficulty = 'N/A';
      section.instructorLastTaught = 'N/A';
    }
    
    // Categorize as section or discussion based on component
    if (row.component === 'DIS' || row.component === 'LAB' || row.component === 'SEM' || row.component === 'SPS') {
      course.discussions.push(section);
    } else {
      course.sections.push(section);
    }
  });
  
  // Convert map to array and sort
  return Array.from(courseMap.values())
    .map(course => {
      // Sort sections and discussions by section number
      course.sections.sort((a, b) => a.sectionNumber.localeCompare(b.sectionNumber));
      course.discussions.sort((a, b) => a.sectionNumber.localeCompare(b.sectionNumber));
      
      // Add hasGPAOver method to each course object
      course.hasGPAOver = function(minGPA) {
        // Check all sections and discussions for GPA >= minGPA
        const allSections = [...this.sections, ...this.discussions];
        
        // Debug logging for first few courses
        if (this.mnemonic === 'CS' && this.number <= 2100) {
          console.log(`🔍 Checking ${this.mnemonic} ${this.number}: ${allSections.length} sections`);
          allSections.forEach(section => {
            console.log(`  Section ${section.sectionNumber}: GPA=${section.instructorGPA}, Teacher=${section.teacherName}`);
          });
        }
        
        return allSections.some(section => {
          if (section.instructorGPA && section.instructorGPA !== 'N/A' && section.instructorGPA !== '—') {
            const gpa = parseFloat(section.instructorGPA);
            return !isNaN(gpa) && gpa >= minGPA;
          }
          return false;
        });
      };
      
      return course;
    })
    .sort((a, b) => a.number - b.number);
}

// Helper function to determine enrollment status
function getEnrollmentStatus(available, status) {
  if (status === 'W') return 'Wait List';
  if (parseInt(available) > 0) return 'Open';
  return 'Closed';
}

// Department categories loaded from departments.csv
let departmentCategories = {};

// Landing page buttons loaded from landing-buttons.csv
let landingButtons = {};

// Helper function to parse CSV line with proper quote handling
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    // Add the last field
    result.push(current.trim());
    
    // Remove quotes from fields
    return result.map(field => field.replace(/^"|"$/g, ''));
}

// Load department categories and landing buttons from CSV
function loadDepartmentCategories() {
    try {
        // Load department categories
        const departmentsPath = path.join(process.cwd(), 'data', 'departments.csv');
        if (fsSync.existsSync(departmentsPath)) {
            const csvContent = fsSync.readFileSync(departmentsPath, 'utf8');
            const lines = csvContent.trim().split('\n');
            const headers = parseCSVLine(lines[0]);
            
            // Find column indices
            const categoryIndex = headers.indexOf('category');
            const nemonicIndex = headers.indexOf('nemonic');
            
            if (categoryIndex !== -1 && nemonicIndex !== -1) {
                // Group departments by category
                for (let i = 1; i < lines.length; i++) {
                    const values = parseCSVLine(lines[i]);
                    const category = values[categoryIndex];
                    const nemonic = values[nemonicIndex];
                    
                    if (category && category !== 'none' && nemonic) {
                        if (!departmentCategories[category]) {
                            departmentCategories[category] = [];
                        }
                        departmentCategories[category].push(nemonic);
                    }
                }
                console.log(`📚 Loaded ${Object.keys(departmentCategories).length} department categories`);
            }
        }

        // Load landing page buttons
        const landingButtonsPath = path.join(process.cwd(), 'data', 'landing-buttons.csv');
        if (fsSync.existsSync(landingButtonsPath)) {
            const csvContent = fsSync.readFileSync(landingButtonsPath, 'utf8');
            const lines = csvContent.trim().split('\n');
            const headers = parseCSVLine(lines[0]);
            
            // Find column indices
            const schoolIndex = headers.indexOf('school');
            const displayNameIndex = headers.indexOf('displayName');
            const typeIndex = headers.indexOf('type');
            const filterIndex = headers.indexOf('filter');
            
            if (schoolIndex !== -1 && displayNameIndex !== -1 && typeIndex !== -1 && filterIndex !== -1) {
                // Group buttons by school
                for (let i = 1; i < lines.length; i++) {
                    const values = parseCSVLine(lines[i]);
                    const school = values[schoolIndex];
                    const displayName = values[displayNameIndex];
                    const type = values[typeIndex];
                    const filter = values[filterIndex];
                    
                    if (school && displayName && type && filter) {
                        if (!landingButtons[school]) {
                            landingButtons[school] = [];
                        }
                        landingButtons[school].push({
                            displayName,
                            type,
                            filter
                        });
                    }
                }
                console.log(`🏠 Loaded landing buttons`);
            }
        }
    } catch (error) {
        console.error('❌ Error loading CSV data:', error);
    }
}

// Helper function to build pagination URLs with current query parameters
function buildPaginationUrl(page, perPage, currentQuery) {
  const url = new URL('http://localhost/catalog'); // Base URL
  const params = new URLSearchParams();
  
  // Add current query parameters
  if (currentQuery.category) params.set('category', currentQuery.category);
  if (currentQuery.department) params.set('department', currentQuery.department);
  if (currentQuery.search) params.set('search', currentQuery.search);
  if (currentQuery.level) params.set('level', currentQuery.level);
  if (currentQuery.status) params.set('status', currentQuery.status);
  if (currentQuery.gpa) params.set('gpa', currentQuery.gpa);
  if (currentQuery.filters) params.set('filters', currentQuery.filters);
  
  // Add pagination parameters
  params.set('page', page.toString());
  params.set('perPage', perPage.toString());
  
  return `?${params.toString()}`;
}

// Routes
app.get('/', (req, res) => {
    res.render('landing', { 
        title: 'UVA Course Search',
        landingButtons 
    });
});

app.get('/catalog', async (req, res) => {
    try {
        const { category, department, search, level, status, gpa, filters, page = 1, perPage = 15 } = req.query;
        
        let courses = [];
        
        try {
            // Load from unified master SIS data file
            const masterPath = path.join(__dirname, 'data', `master-sis-data-1258.csv`);
            
            if (await fs.access(masterPath).then(() => true).catch(() => false)) {
                // Parse master SIS data
                const allSisData = await parseCSV(masterPath);
                
                // Apply search filters
                let filteredData = allSisData;
                
                // Filter by category if specified (overrides department filter)
                if (category && departmentCategories[category]) {
                    const categoryDepartments = departmentCategories[category];
                    filteredData = filteredData.filter(row => categoryDepartments.includes(row.subject));

                }
                // Filter by department if specified (only if no category)
                else if (department) {
                    filteredData = filteredData.filter(row => row.subject === department);

                }
                
                // Filter by search term if specified
                if (search) {
                    const searchLower = search.toLowerCase();
                    filteredData = filteredData.filter(row => {
                        return (
                            (row.course_title && row.course_title.toLowerCase().includes(searchLower)) ||
                            (row.catalog_nbr && row.catalog_nbr.toString().includes(search)) ||
                            (row.subject && row.subject.toLowerCase().includes(searchLower))
                        );
                    });

                }
                
                // Filter by course level if specified
                if (level) {
                    const levelNum = parseInt(level);
                    filteredData = filteredData.filter(row => {
                        if (row.catalog_nbr) {
                            const courseNum = parseInt(row.catalog_nbr);
                            return courseNum >= levelNum && courseNum < levelNum + 1000;
                        }
                        return false;
                    });

                }
                
                // Filter by enrollment status if specified
                if (status) {
                    filteredData = filteredData.filter(row => {
                        const enrollmentStatus = getEnrollmentStatus(row.enrollment_available, row.enrl_stat);
                        return enrollmentStatus.toLowerCase() === status.toLowerCase();
                    });

                }
                
                // Load GPA data
                const gpaData = await loadGPAData();

                
                // Transform filtered data into course objects
                courses = transformSISDataToCourses(filteredData, gpaData);

                
                // Filter by GPA if specified (after object creation)
                if (gpa) {
                    const minGPA = parseFloat(gpa);
                    if (!isNaN(minGPA)) {
                        const beforeCount = courses.length;
                        courses = courses.filter(course => course.hasGPAOver(minGPA));
                    }
                }
                
            } else {
                courses = [];
            }
        } catch (fileError) {
            courses = [];
        }
        
        // Generate dynamic title based on what's being displayed
        let title = 'Course Catalog';
        if (category && departmentCategories[category]) {
            const categoryDepartments = departmentCategories[category];
            // Find display name from landing buttons
            let displayName = null;
            for (const school in landingButtons) {
                const button = landingButtons[school].find(b => b.type === 'category' && b.filter === category);
                if (button) {
                    displayName = button.displayName;
                    break;
                }
            }
            title = displayName ? `${displayName} Courses` : `${categoryDepartments.join(', ')} Courses`;
        } else if (department) {
            title = `${department} Courses`;
        }
        if (search) {
            title = `Search Results for "${search}"`;
        }
        if (level) {
            title = `${level} Level Courses`;
        }
        if (status) {
            title = `${status.charAt(0).toUpperCase() + status.slice(1)} Courses`;
        }
        if (req.query.gpa) {
            title = `${req.query.gpa}+ GPA Courses`;
        }
        
        // Pagination logic
        const currentPage = parseInt(page);
        const itemsPerPage = parseInt(perPage);
        const totalCourses = courses.length;
        const totalPages = Math.ceil(totalCourses / itemsPerPage);
        
        // Get courses for current page
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedCourses = courses.slice(startIndex, endIndex);
        
        // Always create pagination object, even for empty results
        const pagination = {
            currentPage,
            totalPages,
            totalCourses,
            itemsPerPage,
            startIndex: totalCourses > 0 ? startIndex + 1 : 0,
            endIndex: totalCourses > 0 ? Math.min(endIndex, totalCourses) : 0
        };
        
        res.render('catalog', { 
            courses: paginatedCourses, 
            category,
            department,
            search,
            level,
            status,
            gpa: req.query.gpa,
            filters,
            title,
            pagination,
            buildPaginationUrl: (page, perPage) => buildPaginationUrl(page, perPage, req.query)
        });
    } catch (error) {
        console.error('Error rendering catalog:', error);
        res.status(500).render('error', { 
            message: 'Server Error',
            error: 'An error occurred while processing your request.',
            title: 'Server Error'
        });
    }
});

// API Routes
app.get('/api/courses/:subject/:term', async (req, res) => {
    try {
        const { subject, term } = req.params;
        const page = req.query.page || 1;
        
        // Changed from 'organized-term-...' to 'integrated-term-...'
        const dataPath = path.join(__dirname, 'data', `integrated-term-${term}-subject-${subject}-page-${page}.json`);
        
        try {
            const data = await fs.readFile(dataPath, 'utf8');
            const courseData = JSON.parse(data);
            res.json(courseData);
        } catch (fileError) {
            res.status(404).json({ error: 'Data not available' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Search endpoint (placeholder for future AI integration)
app.get('/api/search', (req, res) => {
  const { q, subject, term } = req.query;
  
  // TODO: Implement AI-powered search
  res.json({
    message: 'AI search coming soon!',
    query: q,
    subject,
    term
  });
});

// Load department categories before starting server
loadDepartmentCategories();

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 Course catalog: http://localhost:${PORT}/courses/CS/1258`);
  console.log(`🔍 API endpoint: http://localhost:${PORT}/api/courses/CS/1258`);
}); 