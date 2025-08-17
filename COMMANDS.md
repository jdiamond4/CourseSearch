# CourseSearch Commands Quick Reference

## Add New Department

```bash
# 1. Add department to master SIS data (gets course structure + live enrollment)
node scripts/databuilder.js --subject=PHYS --term=1258

# 2. Get GPA data for that department
node scripts/scrapeCourseForum.js --departmentId=16 --subject=PHYS --term=1258
```

## Update Existing Department

```bash
# Update live enrollment data for any department
node scripts/databuilder.js --subject=CS --term=1258
node scripts/databuilder.js --subject=MATH --term=1258
```

## Update All Departments

```bash
# Update live enrollment data for ALL departments at once
node scripts/databuilder.js --all --term=1258

# This will automatically:
# - Read from data/departments.csv
# - Update each department one by one
# - Show progress and results
```

## Common Codes

```bash
# Term codes
1258 = Fall 2025
1256 = Spring 2025
1254 = Fall 2024

        # Department IDs (for GPA scraping)
        CS = 16
        MATH = 16  
        ASTR = 4
        STAT = 34
        RELB = 26
```

## Server Management

```bash
# Start server
npm start

# Kill existing server
pkill -f "node server.js"

# Restart server
pkill -f "node server.js" && npm start
```

## Testing

```bash
# Test single department update
node scripts/databuilder.js --subject=CS --term=1258

# Test GPA scraping
node scripts/scrapeCourseForum.js --departmentId=16 --subject=CS --term=1258
```

## Workflow

```bash
# 1. Update all departments (gets latest enrollment data)
node scripts/databuilder.js --all --term=1258

# 2. Scrape GPA data for new departments (if needed)
node scripts/scrapeCourseForum.js --departmentId=34 --subject=STAT --term=1258

# 3. Start server to view results
npm start
``` 