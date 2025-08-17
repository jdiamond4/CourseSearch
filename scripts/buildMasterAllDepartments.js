#!/usr/bin/env node
/**
 * Build comprehensive master SIS data CSV with ALL fields from SIS for ALL departments.
 * This will be the single source of truth for all course data across all departments.
 * 
 * Usage:
 *   node scripts/buildMasterAllDepartments.js --term 1258
 *   node scripts/buildMasterAllDepartments.js --term 1258 --departments MATH,CS,PHYS,ECON
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function getArg(name, defaultValue = undefined) {
  // Check for --name=value format first
  const equalsArg = process.argv.find(arg => arg.startsWith(`--${name}=`));
  if (equalsArg) {
    return equalsArg.split('=')[1];
  }
  
  // Check for --name value format
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  
  return defaultValue;
}

function buildUrl({ term, subject, page }) {
  const base = 'https://sisuva.admin.virginia.edu/psc/ihprd/UVSS/SA/s/WEBLIB_HCX_CM.H_CLASS_SEARCH.FieldFormula.IScript_ClassSearch';
  const params = new URLSearchParams({
    institution: 'UVA01',
    term,
    subject,
    page: String(page)
  });
  return `${base}?${params.toString()}`;
}

function flattenClassData(classItem) {
  // Live SIS response has data at top level, not nested in 'raw'
  
  // Extract instructor names as comma-separated string
  const instructorNames = classItem.instructors 
    ? classItem.instructors.map(inst => inst.name).filter(name => name !== '-').join('; ')
    : '';
  
  // Extract instructor emails as comma-separated string
  const instructorEmails = classItem.instructors 
    ? classItem.instructors.map(inst => inst.email).filter(email => email).join('; ')
    : '';
  
  // Extract meeting details
  const meetings = classItem.meetings || [];
  const meetingDays = meetings.map(m => m.days).join('; ');
  const startTimes = meetings.map(m => m.start_time).join('; ');
  const endTimes = meetings.map(m => m.end_time).join('; ');
  const buildings = meetings.map(m => m.bldg_cd).join('; ');
  const rooms = meetings.map(m => m.room).join('; ');
  const facilities = meetings.map(m => m.facility_descr).join('; ');
  
  // Extract course attributes
  const courseAttributes = classItem.crse_attr || '';
  const courseAttributeValues = classItem.crse_attr_value || '';
  
  return {
    // Basic identifiers
    term: classItem.strm || '',
    subject: classItem.subject || '',
    catalog_nbr: classItem.catalog_nbr || '',
    class_nbr: classItem.class_nbr || '',
    class_section: classItem.class_section || '',
    crse_id: classItem.crse_id || '',
    
    // Course details
    course_title: classItem.descr || '',
    units: classItem.units || '',
    component: classItem.component || '',
    section_type: classItem.section_type || '',
    class_type: classItem.class_type || '',
    
    // Enrollment data
    class_capacity: classItem.class_capacity || '',
    enrollment_total: classItem.enrollment_total || '',
    enrollment_available: classItem.enrollment_available || '',
    wait_cap: classItem.wait_cap || '',
    wait_tot: classItem.wait_tot || '',
    enrl_stat: classItem.enrl_stat || '',
    enrl_stat_descr: classItem.enrl_stat_descr || '',
    
    // Instructor data
    instructor_names: instructorNames,
    instructor_emails: instructorEmails,
    
    // Meeting details
    meeting_days: meetingDays,
    start_times: startTimes,
    end_times: endTimes,
    buildings: buildings,
    rooms: rooms,
    facilities: facilities,
    start_date: classItem.start_dt || '',
    end_date: classItem.end_dt || '',
    
    // Location and session
    campus: classItem.campus || '',
    campus_descr: classItem.campus_descr || '',
    location: classItem.location || '',
    location_descr: classItem.location_descr || '',
    session_code: classItem.session_code || '',
    session_descr: classItem.session_descr || '',
    
    // Academic details
    acad_career: classItem.acad_career || '',
    acad_career_descr: classItem.acad_career_descr || '',
    acad_group: classItem.acad_group || '',
    acad_org: classItem.acad_org || '',
    instruction_mode: classItem.instruction_mode || '',
    instruction_mode_descr: classItem.instruction_mode_descr || '',
    grading_basis: classItem.grading_basis || '',
    
    // Course attributes
    course_attributes: courseAttributes,
    course_attribute_values: courseAttributeValues,
    rqmnt_designtn: classItem.rqmnt_designtn || '',
    topic: classItem.topic || '',
    combined_section: classItem.combined_section || '',
    schedule_print: classItem.schedule_print || '',
    
    // Timestamps
    fetched_at: new Date().toISOString()
  };
}

// Helper function to parse CSV
function parseCSV(filePath) {
  try {
    const csvContent = fs.readFileSync(filePath, 'utf8');
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

function getCSVHeaders() {
  return [
    'term', 'subject', 'catalog_nbr', 'class_nbr', 'class_section', 'crse_id',
    'course_title', 'units', 'component', 'section_type', 'class_type',
    'class_capacity', 'enrollment_total', 'enrollment_available', 'wait_cap', 'wait_tot',
    'enrl_stat', 'enrl_stat_descr', 'instructor_names', 'instructor_emails',
    'meeting_days', 'start_times', 'end_times', 'buildings', 'rooms', 'facilities',
    'start_date', 'end_date', 'campus', 'campus_descr', 'location', 'location_descr',
    'session_code', 'session_descr', 'acad_career', 'acad_career_descr',
    'acad_group', 'acad_org', 'instruction_mode', 'instruction_mode_descr',
    'grading_basis', 'course_attributes', 'course_attribute_values',
    'rqmnt_designtn', 'topic', 'combined_section', 'schedule_print', 'fetched_at'
  ];
}

function arrayToCSV(data, headers) {
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header] || '';
      // Escape commas and quotes in CSV
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

async function fetchAllPages(term, subject) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const allClasses = [];
  let currentPage = 1;
  let hasMoreData = true;
  const maxPages = 50; // Safety limit
  
  try {
    while (hasMoreData && currentPage <= maxPages) {
      console.log(`Fetching page ${currentPage} for ${subject}...`);
      
      const url = buildUrl({ term, subject, page: currentPage });
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      if (!response || response.status() >= 400) {
        console.log(`No more data at page ${currentPage}`);
        break;
      }
      
      const body = await response.text();
      let json;
      
      try {
        json = JSON.parse(body);
      } catch (e) {
        console.log(`Failed to parse JSON at page ${currentPage}`);
        break;
      }
      
      const classes = Array.isArray(json?.classes) ? json.classes : [];
      
      if (classes.length === 0) {
        console.log(`No classes found at page ${currentPage}`);
        hasMoreData = false;
        break;
      }
      
      console.log(`Found ${classes.length} classes on page ${currentPage}`);
      
      // Flatten and add all classes
      for (const classItem of classes) {
        const flattened = flattenClassData(classItem);
        
        
        
        allClasses.push(flattened);
      }
      
      currentPage++;
      
      // Small delay to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } finally {
    await browser.close();
  }
  
  return allClasses;
}

async function main() {
  const term = getArg('term', '1258');
  const subject = getArg('subject', 'MATH');
  
  if (!term || !subject) {
    console.error('Missing required arguments: --term and --subject');
    process.exit(1);
  }
  
  console.log(`Building master SIS data for ${subject} in term ${term}...`);
  
  try {
    // Fetch all data for this department
    const newClasses = await fetchAllPages(term, subject);
    
    if (newClasses.length === 0) {
      console.log('No classes found!');
      return;
    }
    
    console.log(`Found ${newClasses.length} classes for ${subject}`);
    
    // Load existing master data if it exists
    const masterPath = path.join(process.cwd(), 'data', `master-sis-data-${term}.csv`);
    let existingData = [];
    let allHeaders = getCSVHeaders();
    
    if (fs.existsSync(masterPath)) {
      console.log(`Loading existing master data from ${masterPath}`);
      existingData = parseCSV(masterPath);
      console.log(`Loaded ${existingData.length} existing records`);
      
      // Remove existing data for this department
      existingData = existingData.filter(row => row.subject !== subject);
      console.log(`Removed existing ${subject} data, keeping ${existingData.length} records from other departments`);
    } else {
      console.log(`No existing master file found at ${masterPath}, creating new one`);
      console.log(`Current working directory: ${process.cwd()}`);
    }
    
    // Combine existing data with new department data
    const allClasses = [...existingData, ...newClasses];
    console.log(`Total records after merge: ${allClasses.length}`);
    
    // Create CSV
    const csvContent = arrayToCSV(allClasses, allHeaders);
    
    // Save to master CSV
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    fs.writeFileSync(masterPath, csvContent);
    console.log(`✅ Master SIS data updated: ${masterPath}`);
    console.log(`📊 Total records: ${allClasses.length}`);
    console.log(`📋 Fields captured: ${allHeaders.length}`);
    console.log(`🔄 Updated ${subject} department data`);
    
    // Also save as JSON for reference
    const jsonFilename = `master-sis-data-${term}.json`;
    const jsonPath = path.join(dataDir, jsonFilename);
    fs.writeFileSync(jsonPath, JSON.stringify(allClasses, null, 2));
    console.log(`📄 JSON backup updated: ${jsonPath}`);
    
  } catch (error) {
    console.error(`❌ Error building master SIS data: ${error.message}`);
    process.exit(1);
  }
}

main(); 