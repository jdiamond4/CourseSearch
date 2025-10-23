require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const https = require('https');
const connectDB = require('./config/database');
const MongoCourse = require('./models/MongoCourse');
const { mongoToCourse } = require('./utils/mongoHelpers');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection flag
let mongoConnected = false;

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

// Helper function to fetch data from GitHub data branch
async function fetchDataFromGitHub(filePath) {
  return new Promise((resolve, reject) => {
    const url = `https://raw.githubusercontent.com/jdiamond4/CourseSearch/data/${filePath}`;
    
    https.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        if (response.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`Failed to fetch data: ${response.statusCode}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// Helper function to parse CSV
async function parseCSV(filePath) {
  try {
    const csvContent = await fs.readFile(filePath, 'utf8');
    const lines = csvContent.trim().split('\n');
    
    // Use the existing parseCSVLine function for proper quote handling
    const headers = parseCSVLine(lines[0]);
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
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

// Helper function to load GPA data from local CSV
async function loadGPAData() {
  try {
    // Load from local file
    const gpaPath = path.join(__dirname, 'data', 'master-gpa-data.csv');
    if (await fs.access(gpaPath).then(() => true).catch(() => false)) {
      const data = await parseCSV(gpaPath);
      return data;
    }
    
    console.log('⚠️  No GPA data file found');
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
          // Multi-instructor match found
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
          // Debug logging removed
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

// Load department categories and landing buttons from local files
async function loadDepartmentCategories() {
    try {
        // Load department categories from local file
        const departmentsPath = path.join(process.cwd(), 'localdata', 'departments.csv');
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
                console.log(`📚 Loaded ${Object.keys(departmentCategories).length} department categories from local file`);
            }
        } else {
            console.log('⚠️  Departments file not found at:', departmentsPath);
        }

        // Load landing page buttons from local file
        const landingButtonsPath = path.join(process.cwd(), 'localdata', 'landing-buttons.csv');
        if (fsSync.existsSync(landingButtonsPath)) {
            const csvContent = fsSync.readFileSync(landingButtonsPath, 'utf8');
            const lines = csvContent.trim().split('\n');
            const headers = parseCSVLine(lines[0]);
            
            const schoolIndex = headers.indexOf('school');
            const displayNameIndex = headers.indexOf('displayName');
            const typeIndex = headers.indexOf('type');
            const filterIndex = headers.indexOf('filter');
            
            if (schoolIndex !== -1 && displayNameIndex !== -1 && typeIndex !== -1 && filterIndex !== -1) {
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
                console.log(`🏠 Loaded landing buttons from local file`);
            }
        } else {
            console.log('⚠️  Landing buttons file not found at:', landingButtonsPath);
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
  
  // Add advanced search parameters
  if (currentQuery.courseNumber) params.set('courseNumber', currentQuery.courseNumber);
  if (currentQuery.units) params.set('units', currentQuery.units);
  if (currentQuery.timeStart) params.set('timeStart', currentQuery.timeStart);
  if (currentQuery.timeEnd) params.set('timeEnd', currentQuery.timeEnd);
  if (currentQuery.requirement) {
    // Handle requirement array
    if (Array.isArray(currentQuery.requirement)) {
      currentQuery.requirement.forEach(req => params.append('requirement', req));
    } else {
      params.set('requirement', currentQuery.requirement);
    }
  }
  
  // Add pagination parameters
  params.set('page', page.toString());
  params.set('perPage', perPage.toString());
  
  return `?${params.toString()}`;
}

// Helper function to parse SIS time format to minutes since midnight
function parseTimeToMinutes(timeStr) {
  try {
    // SIS format: "13.00.00.000000" or similar
    if (timeStr.includes('.')) {
      const parts = timeStr.split('.');
      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      
      if (isNaN(hours) || isNaN(minutes)) return null;
      return hours * 60 + minutes;
    }
    
    // Fallback: assume HHMM format like "1300"
    const timeNum = parseInt(timeStr);
    if (isNaN(timeNum)) return null;
    
    const hours = Math.floor(timeNum / 100);
    const minutes = timeNum % 100;
    return hours * 60 + minutes;
  } catch (error) {
    return null;
  }
}

// Helper function to parse user-provided time to minutes since midnight
function parseUserTimeToMinutes(timeStr) {
  try {
    timeStr = timeStr.trim().toLowerCase();
    
    // Remove spaces
    timeStr = timeStr.replace(/\s+/g, '');
    
    // Check for AM/PM
    const isPM = timeStr.includes('pm');
    const isAM = timeStr.includes('am');
    
    // Remove AM/PM
    timeStr = timeStr.replace(/am|pm/g, '');
    
    // Parse time
    let hours, minutes;
    
    if (timeStr.includes(':')) {
      // Format: "10:30" or "2:30"
      const parts = timeStr.split(':');
      hours = parseInt(parts[0]);
      minutes = parseInt(parts[1] || 0);
    } else {
      // Format: "1030" or "230"
      const timeNum = parseInt(timeStr);
      if (timeStr.length <= 2) {
        // Just hours: "10" or "2"
        hours = timeNum;
        minutes = 0;
      } else {
        // HHMM format: "1030"
        hours = Math.floor(timeNum / 100);
        minutes = timeNum % 100;
      }
    }
    
    // Convert to 24-hour format if PM
    if (isPM && hours !== 12) {
      hours += 12;
    } else if (isAM && hours === 12) {
      hours = 0;
    }
    
    if (isNaN(hours) || isNaN(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    
    return hours * 60 + minutes;
  } catch (error) {
    return null;
  }
}

// Routes
app.get('/', (req, res) => {
    res.render('landing', { 
        title: 'HoosList - UVA Course Search',
        landingButtons 
    });
});

app.get('/advanced-search', (req, res) => {
    res.render('advanced-search', {
        title: 'Advanced Search',
        department: req.query.department || '',
        courseNumber: req.query.courseNumber || '',
        search: req.query.search || '',
        units: req.query.units || '',
        status: req.query.status || '',
        gpa: req.query.gpa || '',
        timeStart: req.query.timeStart || '',
        timeEnd: req.query.timeEnd || '',
        requirement: req.query.requirement || ''
    });
});

app.get('/catalog', async (req, res) => {
    try {
        const { category, department, search, level, status, gpa, filters, page = 1, perPage = 15, courseNumber, units, timeStart, timeEnd } = req.query;
        const term = req.query.term || '1262'; // Default to Spring 2026
        
        // Handle requirement parameter (can be array or single value)
        let requirements = req.query.requirement;
        if (requirements && !Array.isArray(requirements)) {
            requirements = [requirements];
        }
        
        let courses = [];
        
        try {
            // Try MongoDB first
            if (mongoConnected) {
                // Build MongoDB query
                const query = { term };
                
                // Filter by category (multiple subjects)
                if (category && departmentCategories[category]) {
                    const categoryDepartments = departmentCategories[category];
                    query.subject = { $in: categoryDepartments };
                }
                // Filter by department (single subject)
                else if (department) {
                    query.subject = department.toUpperCase();
                }
                
                // Filter by search term
                if (search) {
                    const searchRegex = new RegExp(search, 'i');
                    query.$or = [
                        { title: searchRegex },
                        { catalog_nbr: searchRegex },
                        { subject: searchRegex }
                    ];
                }
                
                // Filter by course level
                if (level) {
                    const levelNum = parseInt(level);
                    // Use regex to match course numbers starting with the level digit
                    query.catalog_nbr = new RegExp(`^${levelNum.toString().charAt(0)}`);
                }
                
                // Filter by course number (exact or range)
                if (courseNumber) {
                    if (courseNumber.includes('-')) {
                        // Range query (e.g., "2000-3000")
                        const [minStr, maxStr] = courseNumber.split('-').map(s => s.trim());
                        const min = parseInt(minStr);
                        const max = parseInt(maxStr);
                        if (!isNaN(min) && !isNaN(max)) {
                            // Match courses where catalog_nbr is between min and max
                            query.catalog_nbr = {
                                $gte: min.toString(),
                                $lte: max.toString()
                            };
                        }
                    } else {
                        // Exact match
                        query.catalog_nbr = courseNumber.trim();
                    }
                }
                
                // Filter by units
                if (units) {
                    query.units = units.trim();
                }
                
                // Filter by course requirements (multiple values with OR logic)
                if (requirements && requirements.length > 0) {
                    // Match if courseAttributeValues contains ANY of the selected requirements
                    const requirementRegexes = requirements.map(req => new RegExp(req, 'i'));
                    query.courseAttributeValues = { $in: requirementRegexes };
                }
                
                // Fetch courses from MongoDB
                const mongoCourses = await MongoCourse.find(query)
                    .sort({ subject: 1, catalog_nbr: 1 })
                    .lean();
                
                // Load GPA data from local CSV
                const gpaData = await loadGPAData();
                
                // Convert MongoDB documents to course model instances and merge GPA data
                courses = mongoCourses.map(mongoCourse => {
                    const course = mongoToCourse(mongoCourse);
                    
                    // Merge GPA data into sections
                    course.sections.forEach(section => {
                        if (section.teacherName && section.teacherName !== 'TBA') {
                            const gpaMatch = findMatchingGPA(gpaData, mongoCourse.subject, mongoCourse.catalog_nbr, section.teacherName);
                            if (gpaMatch) {
                                section.instructorGPA = gpaMatch.instructorGPA || 'N/A';
                                section.instructorRating = gpaMatch.instructorRating || 'N/A';
                                section.instructorDifficulty = gpaMatch.instructorDifficulty || 'N/A';
                                section.instructorLastTaught = gpaMatch.instructorLastTaught || 'N/A';
                            }
                        }
                    });
                    
                    // Merge GPA data into discussions
                    course.discussions.forEach(discussion => {
                        if (discussion.teacherName && discussion.teacherName !== 'TBA') {
                            const gpaMatch = findMatchingGPA(gpaData, mongoCourse.subject, mongoCourse.catalog_nbr, discussion.teacherName);
                            if (gpaMatch) {
                                discussion.instructorGPA = gpaMatch.instructorGPA || 'N/A';
                                discussion.instructorRating = gpaMatch.instructorRating || 'N/A';
                                discussion.instructorDifficulty = gpaMatch.instructorDifficulty || 'N/A';
                                discussion.instructorLastTaught = gpaMatch.instructorLastTaught || 'N/A';
                            }
                        }
                    });
                    
                    return course;
                });
                
                // Filter by enrollment status (in-memory, after conversion)
                if (status) {
                    courses = courses.filter(course => {
                        return course.sections.some(section => 
                            section.status.toLowerCase() === status.toLowerCase()
                        );
                    });
                }
                
                // Filter by GPA (in-memory, after conversion)
                if (gpa) {
                    const minGPA = parseFloat(gpa);
                    if (!isNaN(minGPA)) {
                        courses = courses.filter(course => course.hasGPAOver(minGPA));
                    }
                }
                
                // Filter by time range (in-memory, after conversion)
                if (timeStart || timeEnd) {
                    courses = courses.filter(course => {
                        // Check if ANY section falls within the time range
                        const allSections = [...course.sections, ...course.discussions];
                        
                        return allSections.some(section => {
                            // Parse section times (in SIS format like "13.00.00.000000")
                            let sectionStartTime = null;
                            let sectionEndTime = null;
                            
                            if (section.startTime && section.startTime !== 0 && section.startTime !== '') {
                                sectionStartTime = parseTimeToMinutes(section.startTime.toString());
                            }
                            if (section.endTime && section.endTime !== 0 && section.endTime !== '') {
                                sectionEndTime = parseTimeToMinutes(section.endTime.toString());
                            }
                            
                            // If section has no valid times, skip it
                            if (sectionStartTime === null || sectionEndTime === null) {
                                return false;
                            }
                            
                            // Parse user-provided time range
                            let userStartMinutes = null;
                            let userEndMinutes = null;
                            
                            if (timeStart) {
                                userStartMinutes = parseUserTimeToMinutes(timeStart);
                            }
                            if (timeEnd) {
                                userEndMinutes = parseUserTimeToMinutes(timeEnd);
                            }
                            
                            // Check if section falls within range
                            let matchesStart = true;
                            let matchesEnd = true;
                            
                            if (userStartMinutes !== null) {
                                matchesStart = sectionStartTime >= userStartMinutes;
                            }
                            if (userEndMinutes !== null) {
                                matchesEnd = sectionEndTime <= userEndMinutes;
                            }
                            
                            return matchesStart && matchesEnd;
                        });
                    });
                }
                
            } else {
                // Fallback to CSV if MongoDB not connected
                console.log('⚠️  MongoDB not connected, falling back to CSV...');
                let allSisData = [];
                
                try {
                    // Try to load from GitHub first
                    const csvContent = await fetchDataFromGitHub('data/master-sis-data-1258.csv');
                    const lines = csvContent.trim().split('\n');
                    const headers = parseCSVLine(lines[0]);
                    
                    for (let i = 1; i < lines.length; i++) {
                        const values = parseCSVLine(lines[i]);
                        const row = {};
                        headers.forEach((header, index) => {
                            row[header] = values[index] || '';
                        });
                        allSisData.push(row);
                    }
                
                } catch (error) {
                    console.log('⚠️  Could not load SIS data from GitHub, using local fallback');
                    const masterPath = path.join(__dirname, 'data', `master-sis-data-1258.csv`);
                    
                    if (await fs.access(masterPath).then(() => true).catch(() => false)) {
                        allSisData = await parseCSV(masterPath);
                    }
                }
                
                if (allSisData.length > 0) {
                    // Apply filters
                    let filteredData = allSisData;
                    
                    if (category && departmentCategories[category]) {
                        const categoryDepartments = departmentCategories[category];
                        filteredData = filteredData.filter(row => categoryDepartments.includes(row.subject));
                    }
                    else if (department) {
                        filteredData = filteredData.filter(row => row.subject.toLowerCase() === department.toLowerCase());
                    }
                    
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
                    
                    if (status) {
                        filteredData = filteredData.filter(row => {
                            const enrollmentStatus = getEnrollmentStatus(row.enrollment_available, row.enrl_stat);
                            return enrollmentStatus.toLowerCase() === status.toLowerCase();
                        });
                    }
                    
                    const gpaData = await loadGPAData();
                    courses = transformSISDataToCourses(filteredData, gpaData);
                    
                    if (gpa) {
                        const minGPA = parseFloat(gpa);
                        if (!isNaN(minGPA)) {
                            courses = courses.filter(course => course.hasGPAOver(minGPA));
                        }
                    }
                } else {
                    courses = [];
                }
            }
        } catch (error) {
            console.error('Error loading courses:', error);
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

// Load department categories and start server
async function startServer() {
  try {
    // Try to connect to MongoDB
    try {
      await connectDB();
      mongoConnected = true;
      console.log('✅ MongoDB connected - using MongoDB for course data');
    } catch (error) {
      console.warn('⚠️  MongoDB connection failed - will use CSV fallback');
      console.warn('   Error:', error.message);
      mongoConnected = false;
    }
    
    await loadDepartmentCategories();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log(`📚 Course catalog: http://localhost:${PORT}/catalog?department=CS`);
      console.log(`🏠 Landing page: http://localhost:${PORT}/`);
      console.log(`\n💾 Data source: ${mongoConnected ? 'MongoDB' : 'CSV (fallback)'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer(); 