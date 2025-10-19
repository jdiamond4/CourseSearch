#!/usr/bin/env node
/**
 * SIS to MongoDB Integration Script
 * Fetches course data from UVA SIS API and stores it in MongoDB
 * 
 * Usage:
 *   node scripts/sisToMongo.js --term=1262 --subject=CS
 *   node scripts/sisToMongo.js --term=1262 --subject=MATH --replace
 *   node scripts/sisToMongo.js --term=1262 --all
 *   node scripts/sisToMongo.js --term=1262 --all --max-concurrent=3
 */

require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/database');
const SISProcessor = require('../utils/sisProcessor');
const MongoUpserter = require('../utils/mongoUpserter');

// Parse command line arguments
function getArg(name, defaultValue = undefined) {
  const equalsArg = process.argv.find(arg => arg.startsWith(`--${name}=`));
  if (equalsArg) {
    return equalsArg.split('=')[1];
  }
  
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  
  return defaultValue;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

// Build SIS API URL
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

// Fetch data from SIS API for a single page
async function fetchSISPage(term, subject, page) {
  const url = buildUrl({ term, subject, page });
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
    const json = JSON.parse(body);
    
    const classes = Array.isArray(json?.classes) ? json.classes : Array.isArray(json) ? json : [];
    
    return {
      success: true,
      classes,
      page,
      count: classes.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      page,
      count: 0
    };
  } finally {
    await browser.close();
  }
}

// Fetch all pages for a subject
async function fetchAllPagesForSubject(term, subject) {
  console.log(`\n📥 Fetching ${subject} data from SIS API...`);
  
  let page = 1;
  let allClasses = [];
  let hasMoreData = true;
  const maxPages = 50; // Safety limit

  while (hasMoreData && page <= maxPages) {
    console.log(`   Page ${page}...`);
    
    const result = await fetchSISPage(term, subject, page);
    
    if (!result.success) {
      console.log(`   ⚠️  Error on page ${page}: ${result.error}`);
      break;
    }
    
    if (result.count === 0) {
      console.log(`   ✅ No more data (${page - 1} pages total)`);
      break;
    }
    
    allClasses = allClasses.concat(result.classes);
    console.log(`   ✅ Page ${page}: ${result.count} classes (${allClasses.length} total)`);
    
    page++;
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return {
    subject,
    classes: allClasses,
    totalClasses: allClasses.length,
    pages: page - 1
  };
}

// Load department list
function loadDepartments() {
  try {
    const departmentsPath = path.join(process.cwd(), 'localdata', 'departments.csv');
    if (!fs.existsSync(departmentsPath)) {
      console.error('❌ departments.csv not found at:', departmentsPath);
      return [];
    }

    const csvContent = fs.readFileSync(departmentsPath, 'utf8');
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const nemonicIndex = headers.indexOf('nemonic');
    
    if (nemonicIndex === -1) {
      console.error('❌ Could not find "nemonic" column in departments.csv');
      return [];
    }

    const departments = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const nemonic = values[nemonicIndex];
      if (nemonic && nemonic !== 'none') {
        departments.push(nemonic);
      }
    }

    return departments;
  } catch (error) {
    console.error('❌ Error loading departments:', error.message);
    return [];
  }
}

// Process and upsert data for a single subject
async function processSubject(term, subject, options = {}) {
  const { replace = false } = options;
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📚 Processing ${subject} for term ${term}`);
  console.log('='.repeat(80));

  try {
    // Step 1: Fetch data from SIS API
    const fetchResult = await fetchAllPagesForSubject(term, subject);
    
    if (fetchResult.totalClasses === 0) {
      console.log(`\n⚠️  No classes found for ${subject}`);
      return {
        success: true,
        subject,
        message: 'No classes found',
        stats: { inserted: 0, updated: 0, failed: 0 }
      };
    }

    console.log(`\n✅ Fetched ${fetchResult.totalClasses} classes from ${fetchResult.pages} pages`);

    // Step 2: Process data with SISProcessor
    console.log(`\n🔄 Processing and grouping data...`);
    const processor = new SISProcessor();
    const courseDocs = processor.processSISResponse(
      { classes: fetchResult.classes },
      term
    );

    console.log(`✅ Processed into ${courseDocs.length} unique courses`);

    const stats = processor.getStatistics(courseDocs);
    console.log(`   Sections: ${stats.totalSections}`);
    console.log(`   Discussions/Labs: ${stats.totalDiscussions}`);

    // Step 3: Upsert to MongoDB
    console.log(`\n💾 Saving to MongoDB...`);
    const upserter = new MongoUpserter();
    const result = await upserter.upsertSubject(courseDocs, term, subject, { 
      replaceExisting: replace,
      showProgress: true 
    });

    // Show any errors
    if (result.stats.errors.length > 0) {
      upserter.printErrors();
    }

    return {
      success: true,
      subject,
      stats: result.stats,
      coursesProcessed: courseDocs.length
    };

  } catch (error) {
    console.error(`\n❌ Error processing ${subject}:`, error.message);
    return {
      success: false,
      subject,
      error: error.message
    };
  }
}

// Main function
async function main() {
  const term = getArg('term', '1262');
  const subject = getArg('subject');
  const allDepartments = hasFlag('all');
  const replace = hasFlag('replace');
  const maxConcurrent = parseInt(getArg('max-concurrent', '1'));

  console.log('\n🚀 SIS to MongoDB Integration Script');
  console.log('=====================================\n');
  console.log(`Term: ${term}`);
  console.log(`Mode: ${allDepartments ? 'All Departments' : `Single Department (${subject})`}`);
  console.log(`Replace Existing: ${replace ? 'Yes' : 'No'}`);

  if (!term) {
    console.error('\n❌ Error: --term is required');
    console.log('\nUsage:');
    console.log('  node scripts/sisToMongo.js --term=1262 --subject=CS');
    console.log('  node scripts/sisToMongo.js --term=1262 --all');
    process.exit(1);
  }

  if (!allDepartments && !subject) {
    console.error('\n❌ Error: Either --subject or --all is required');
    process.exit(1);
  }

  try {
    // Connect to MongoDB
    console.log('\n🔌 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ MongoDB connected');

    // Ensure semester exists
    const upserter = new MongoUpserter();
    const semesterName = getSemesterName(term);
    await upserter.ensureSemester(term, semesterName, true);

    // Process subjects
    const results = [];

    if (allDepartments) {
      const departments = loadDepartments();
      console.log(`\n📋 Found ${departments.length} departments to process`);
      
      for (const dept of departments) {
        const result = await processSubject(term, dept, { replace });
        results.push(result);
        
        // Small delay between departments
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      const result = await processSubject(term, subject, { replace });
      results.push(result);
    }

    // Print summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));

    const totalInserted = results.reduce((sum, r) => sum + (r.stats?.inserted || 0), 0);
    const totalUpdated = results.reduce((sum, r) => sum + (r.stats?.updated || 0), 0);
    const totalFailed = results.reduce((sum, r) => sum + (r.stats?.failed || 0), 0);
    const successfulSubjects = results.filter(r => r.success).length;
    const failedSubjects = results.filter(r => !r.success).length;

    console.log(`\nSubjects processed: ${results.length}`);
    console.log(`  Successful: ${successfulSubjects}`);
    console.log(`  Failed: ${failedSubjects}`);
    console.log(`\nCourses:`);
    console.log(`  Inserted: ${totalInserted}`);
    console.log(`  Updated: ${totalUpdated}`);
    console.log(`  Failed: ${totalFailed}`);

    // Get final statistics from MongoDB
    console.log('\n📈 Database Statistics:');
    const dbStats = await upserter.getTermStatistics(term);
    console.log(`  Total Courses in DB: ${dbStats.totalCourses}`);
    console.log(`  Total Sections: ${dbStats.totalSections}`);
    console.log(`  Total Discussions/Labs: ${dbStats.totalDiscussions}`);
    console.log(`  Subjects: ${dbStats.subjects.length}`);

    console.log('\n✅ Complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Helper function to get semester name from term code
function getSemesterName(term) {
  // Term code format: 1262 = 1(century)2(decade)6(year)2(semester)
  // Last digit: 2=Spring, 6=Summer, 8=Fall
  const year = parseInt('20' + term.substring(1, 3));
  const semesterCode = term.substring(3);
  
  const semesterMap = {
    '2': 'Spring',
    '6': 'Summer',
    '8': 'Fall'
  };
  
  const semester = semesterMap[semesterCode] || 'Unknown';
  return `${semester} ${year}`;
}

// Run the script
main();

