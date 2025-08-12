# GPA Data Scraping and Integration Guide

This guide explains how to use the new GPA scraping system that integrates data from theCourseForum with your existing SIS course data.

## Overview

The system now includes:
1. **CourseForum Scraper** - Extracts GPA, rating, and difficulty data from theCourseForum
2. **Data Integration** - Combines CourseForum data with SIS course data
3. **Enhanced Display** - Shows GPA data in the modern UI

## How It Works

### 1. Data Sources
- **SIS Data**: Course structure, enrollment, times, locations, instructors
- **CourseForum Data**: GPA, ratings, difficulty, course titles, last taught semester

### 2. Integration Process
- Scrapes CourseForum for CS courses taught in Fall 2025
- Matches courses by course ID (e.g., "CS 1110")
- Adds GPA data to existing SIS course structure
- Preserves all original SIS data while enriching with CourseForum insights

## Usage Instructions

### Step 1: Scrape CourseForum Data

```bash
node scripts/scrapeCourseForum.js
```

**What this does:**
- Navigates to [theCourseForum CS department page](https://thecourseforum.com/department/31/)
- Extracts course listings and overall stats
- Filters for Fall 2025 offerings
- Saves data to `data/courseforum-gpa-data.json`

**Output:**
- Course IDs and titles
- Overall course ratings, difficulty, and GPA
- Last taught semester information

**Note:** The scraper runs in non-headless mode by default so you can see what's happening. Set `headless: true` in production.

### Step 2: Integrate with SIS Data

```bash
node scripts/integrateGPAData.js --term=1258 --subject=CS --page=1
```

**What this does:**
- Loads CourseForum GPA data
- Loads organized SIS data
- Matches courses by course ID
- Creates integrated dataset with both data sources
- Saves to `data/integrated-term-1258-subject-CS-page-1.json`

**Integration Results:**
- Courses with CourseForum data get enriched with GPA, ratings, and difficulty
- Courses without CourseForum data keep original SIS data
- All enrollment, time, and location data is preserved

### Step 3: Generate Enhanced UI

```bash
node scripts/renderModernUI.js --term=1258 --subject=CS --page=1
```

**What this does:**
- Uses the integrated data (SIS + CourseForum)
- Displays GPA data alongside course information
- Shows course ratings and difficulty
- Maintains all existing functionality

## Data Structure

### Before Integration (SIS Only)
```json
{
  "mnemonic": "CS",
  "number": 1110,
  "sections": [
    {
      "teacherName": "Arohi Khargonkar",
      "averageGPA": 0,
      "currentEnrollment": 203,
      "maxEnrollment": 250
    }
  ]
}
```

### After Integration (SIS + CourseForum)
```json
{
  "mnemonic": "CS",
  "number": 1110,
  "courseForumData": {
    "overallRating": "3.97",
    "overallDifficulty": "3.13",
    "overallGPA": "3.41",
    "title": "Introduction to Programming"
  },
  "sections": [
    {
      "teacherName": "Arohi Khargonkar",
      "averageGPA": 0,
      "currentEnrollment": 203,
      "maxEnrollment": 250,
      "courseForumRating": "N/A",
      "courseForumDifficulty": "N/A",
      "lastTaught": "N/A"
    }
  ]
}
```

## Current Limitations

### 1. Instructor Matching
- **Issue**: Instructor names from SIS don't exactly match CourseForum names
- **Example**: SIS shows "Arohi Khargonkar", CourseForum might show "Arohi K."
- **Impact**: Individual instructor GPA data isn't populated
- **Workaround**: Course-level GPA data is still available

### 2. Coverage
- **Current**: 10 out of 33 courses have GPA data (30.3% integration rate)
- **Reason**: Some courses aren't offered in Fall 2025 or haven't been reviewed
- **Future**: Can expand to other terms and subjects

### 3. Data Freshness
- **CourseForum data**: Scraped when you run the script
- **SIS data**: Fetched when you run fetchSis.js
- **Recommendation**: Run both scripts before generating UI for fresh data

## Troubleshooting

### Scraping Issues
```bash
# If scraper fails to load page
- Check internet connection
- Verify theCourseForum is accessible
- Check if page structure has changed
- Look at page-screenshot.png for visual debugging
```

### Integration Issues
```bash
# If integration fails
- Ensure scrapeCourseForum.js ran successfully
- Check that courseforum-gpa-data.json exists
- Verify SIS data is organized (run processAndOrganize.js first)
- Check console output for specific error messages
```

### Data Quality Issues
```bash
# If GPA data seems incorrect
- Verify CourseForum data is current
- Check if course numbers match between systems
- Look for typos or naming variations
- Consider manual verification for critical courses
```

## Future Enhancements

### 1. Better Instructor Matching
- Implement fuzzy name matching algorithms
- Handle abbreviations and middle names
- Cross-reference with UVA directory data

### 2. Expanded Coverage
- Scrape multiple terms (Spring, Summer, Fall)
- Add other departments (MATH, ENGL, etc.)
- Include historical GPA trends

### 3. Enhanced Data
- Individual instructor ratings
- Student comments and feedback
- Course workload assessments
- Prerequisite difficulty ratings

## Best Practices

### 1. Regular Updates
- Run scraper weekly during registration periods
- Update SIS data before major course planning
- Keep integrated data files for historical analysis

### 2. Data Validation
- Cross-check GPA data with official UVA statistics
- Verify course numbers and titles match
- Monitor for significant data discrepancies

### 3. Performance
- Run scrapers during off-peak hours
- Use headless mode in production
- Implement rate limiting to respect CourseForum servers

## Example Workflow

```bash
# Complete workflow for getting fresh data with GPA
node scripts/fetchSis.js --term=1258 --subject=CS --page=1
node scripts/processAndOrganize.js --term=1258 --subject=CS --page=1
node scripts/scrapeCourseForum.js
node scripts/integrateGPAData.js --term=1258 --subject=CS --page=1
node scripts/renderModernUI.js --term=1258 --subject=CS --page=1
```

This gives you a complete, up-to-date course search system with both enrollment data and GPA insights from student reviews. 