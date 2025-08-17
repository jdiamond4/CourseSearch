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

## Common Department Codes

- `CS` - Computer Science
- `MATH` - Mathematics  
- `PHYS` - Physics
- `CHEM` - Chemistry
- `BIOL` - Biology
- `ECON` - Economics
- `ENGL` - English
- `HIST` - History
- `PSYC` - Psychology

## Start/Stop Server

```bash
# Start server
node server.js

# Stop server (in another terminal)
pkill -f "node server.js"
```

## Test the System

```bash
# Test CS courses
curl "http://localhost:3000/catalog?department=CS"

# Test MATH courses  
curl "http://localhost:3000/catalog?department=MATH"

# Test search
curl "http://localhost:3000/catalog?search=Programming"
```

## Workflow for New Semester

1. **Update all departments** with fresh SIS data
2. **Get fresh GPA data** for all departments
3. **Run enrollment updates** every few minutes during peak season 