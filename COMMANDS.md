# HoosList Commands Quick Reference

## Automated Data Updates (GitHub Actions)

A GitHub Action automatically runs every hour to update MongoDB with the latest course data for all departments.

### Viewing the Action
- Go to the "Actions" tab in your GitHub repository
- Select "Update MongoDB Course Data" workflow
- View past runs and their logs

### Manual Trigger
- Go to Actions > "Update MongoDB Course Data"
- Click "Run workflow" button
- Select branch and click "Run workflow"

### Configuration
- Location: `.github/workflows/update-mongodb.yml`
- Schedule: Every hour at `:00` (cron: `0 * * * *`)
- Command: `node scripts/sisToMongo.js --term=1262 --all --replace`
- Required Secret: `MONGODB_URI` (see `.github/SETUP_SECRETS.md` for setup instructions)

### Updating for New Semester
Edit the workflow file and change the term code in the command:
```bash
run: node scripts/sisToMongo.js --term=1268 --all --replace  # Change 1262 to new term
```

## MongoDB Data Management (Current System)

### Fetch and Store Course Data

```bash
# Fetch single department for current semester (Spring 2026)
node scripts/sisToMongo.js --term=1262 --subject=CS

# Fetch specific department
node scripts/sisToMongo.js --term=1262 --subject=MATH

# Fetch ALL departments (recommended for semester updates)
node scripts/sisToMongo.js --term=1262 --all

# Replace existing data for a department
node scripts/sisToMongo.js --term=1262 --subject=CS --replace
```

### View MongoDB Data

```bash
# View courses in MongoDB
node scripts/viewMongoCourses.js 1262 CS

# View all courses for a term
node scripts/viewMongoCourses.js 1262
```

### GPA Data Integration

GPA data is stored locally in `localdata/master-gpa-data.csv` and loaded by the server automatically.

```bash
# Scrape GPA data for a single department (updates local CSV)
node scripts/scrapeCourseForum.js --departmentId=31 --subject=CS --term=1262

# Scrape GPA data for all departments (takes ~30 minutes)
node scripts/scrapeCourseForum.js --all --term=1262

# Scrape GPA data in ranges (recommended for better control)
node scripts/scrapeCourseForum.js --range=1-10 --term=1262
node scripts/scrapeCourseForum.js --range=11-20 --term=1262
node scripts/scrapeCourseForum.js --range=21-30 --term=1262
node scripts/scrapeCourseForum.js --range=31-40 --term=1262
node scripts/scrapeCourseForum.js --range=41-50 --term=1262
node scripts/scrapeCourseForum.js --range=51-61 --term=1262

# GPA data is automatically merged with course data when displaying
# The server loads from localdata/master-gpa-data.csv on each page load
```

## Term Codes

```bash
# Current and upcoming terms
1262 = Spring 2026 (Current)
1268 = Fall 2026
1272 = Spring 2027

# Past terms
1258 = Fall 2025
1256 = Summer 2025
1252 = Spring 2025
```

## Department IDs (for CourseForum GPA scraping)

```bash
CS = 31
MATH = 21
ASTR = 4
STAT = 34
PHYS = 24
CHEM = 10
```

## Server Management

```bash
# Start server (uses MongoDB by default, falls back to CSV)
npm start

# Start in development mode with auto-reload
npm run dev

# Kill existing server
pkill -f "node server.js"

# Restart server
pkill -f "node server.js" && npm start
```

## MongoDB Connection

```bash
# Server automatically connects to MongoDB on startup
# If MongoDB fails, it falls back to CSV files

# Connection string is stored in .env file:
MONGODB_URI=mongodb+srv://...

# Check if MongoDB is connected by looking at server startup logs:
# ✅ MongoDB connected - using MongoDB for course data
# OR
# ⚠️  MongoDB connection failed - will use CSV fallback
```

## Complete Semester Update Workflow

```bash
# 1. Fetch all course data for new semester (Spring 2026)
node scripts/sisToMongo.js --term=1262 --all

# 2. Scrape GPA data for all departments (in batches recommended)
node scripts/scrapeCourseForum.js --range=1-10 --term=1262
node scripts/scrapeCourseForum.js --range=11-20 --term=1262
node scripts/scrapeCourseForum.js --range=21-30 --term=1262
node scripts/scrapeCourseForum.js --range=31-40 --term=1262
node scripts/scrapeCourseForum.js --range=41-50 --term=1262
node scripts/scrapeCourseForum.js --range=51-61 --term=1262

# 3. Start server to view results
npm start

# 4. Visit http://localhost:3000 to see the courses
```

## Quick Department Update

```bash
# Update just CS department with latest data
node scripts/sisToMongo.js --term=1262 --subject=CS --replace

# The server will automatically pick up the new data
# (No restart needed if MongoDB is connected)
```

## Troubleshooting

```bash
# View what's in MongoDB
node scripts/viewMongoCourses.js 1262 CS

# Check MongoDB connection
# Look for this in server logs: "✅ MongoDB connected"

# If MongoDB fails, server falls back to CSV files automatically

# To force CSV usage, disconnect MongoDB or remove MONGODB_URI from .env
```

## Legacy CSV System (Backup)

The old CSV-based system is still available as a fallback:

```bash
# Old databuilder script (creates CSV files)
node scripts/databuilder.js --subject=CS --term=1258

# Server will use these CSV files if MongoDB is unavailable
``` 