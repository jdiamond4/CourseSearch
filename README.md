# CourseSearch - UVA Course Search and Catalog System

A comprehensive system for scraping, storing, and searching UVA course data with GPA information from theCourseForum.

## 🚀 **Quick Start**

### **Scrape GPA Data for Any Department**
```bash
# Scrape MATH department (department ID 16)
node scripts/scrapeCourseForum.js --departmentId=16 --subject=MATH

# Scrape CS department (department ID 31) 
node scripts/scrapeCourseForum.js --departmentId=31 --subject=CS

# Scrape with term filter (e.g., only Fall 2025 courses)
node scripts/scrapeCourseForum.js --departmentId=16 --subject=MATH --term=1258

# Scrape any other department by changing departmentId and subject
```

### **Integrate GPA Data with SIS Data**
```bash
# After scraping, integrate with SIS data
node scripts/integrateGPAData.js MATH 1258 1
node scripts/integrateGPAData.js CS 1258 1
```

### **Start the Web Server**
```bash
npm start
# Visit http://localhost:3000/catalog?department=MATH
# Visit http://localhost:3000/catalog?department=CS
```

## 📊 **System Architecture**

### **Unified GPA Data System**
- **Master CSV**: All GPA data consolidated in `data/master-gpa-data.csv`
- **Department Scraping**: Generic scraper works with any department
- **Data Integration**: Seamlessly combines GPA and SIS data

### **Data Flow**
1. **Scrape** → `scrapeCourseForum.js` collects GPA data from any department
2. **Consolidate** → Data automatically added to master CSV
3. **Integrate** → `integrateGPAData.js` merges GPA data with SIS data
4. **Serve** → Web interface displays integrated course information

## 🛠 **Available Scripts**

### **Core Scripts**
- **`scrapeCourseForum.js`** - Scrapes GPA data from any department
- **`integrateGPAData.js`** - Integrates GPA data with SIS data
- **`fetchSis.js`** - Fetches course data from UVA SIS
- **`processAndOrganize.js`** - Processes and organizes SIS data

### **Utility Scripts**
- **`buildCourseCatalog.js`** - Builds complete course catalog
- **`renderDepartmentView.js`** - Generates department-specific views
- **`renderModernUI.js`** - Creates modern UI components

## 📁 **Data Structure**

### **Master GPA CSV Schema**
```csv
department,courseNumber,courseTitle,instructorName,instructorGPA,instructorRating,instructorDifficulty,instructorLastTaught,courseOverallGPA,courseOverallRating,courseOverallDifficulty,courseLastTaught,scrapedAt
```

### **File Organization**
```
data/
├── master-gpa-data.csv          # Consolidated GPA data
├── courseforum-math-gpa-data.json    # Department-specific data
├── courseforum-cs-gpa-data.json      # Department-specific data
├── integrated-term-1258-subject-MATH-page-1.json  # Integrated data
└── integrated-term-1258-subject-CS-page-1.json    # Integrated data
```

## 🔧 **Configuration**

### **Department IDs**
- **MATH**: 16
- **CS**: 31
- **PHYS**: 22
- **CHEM**: 18
- **BIOL**: 17

### **Term Codes**
- **1258**: Fall 2025
- **1256**: Spring 2025
- **1254**: Fall 2024

## 📈 **Usage Examples**

### **Complete Workflow for MATH Department**
```bash
# 1. Scrape GPA data (only Fall 2025 courses)
node scripts/scrapeCourseForum.js --departmentId=16 --subject=MATH --term=1258

# 2. Fetch SIS data (if not already available)
node scripts/fetchSis.js --term=1258 --subject=MATH --page=1

# 3. Process SIS data
node scripts/processAndOrganize.js --term=1258 --subject=MATH --page=1

# 4. Integrate GPA and SIS data
node scripts/integrateGPAData.js MATH 1258 1

# 5. View results
open http://localhost:3000/catalog?department=MATH
```

### **Batch Processing Multiple Departments**
```bash
# Scrape multiple departments (only Fall 2025 courses)
node scripts/scrapeCourseForum.js --departmentId=16 --subject=MATH --term=1258
node scripts/scrapeCourseForum.js --departmentId=31 --subject=CS --term=1258
node scripts/scrapeCourseForum.js --departmentId=22 --subject=PHYS --term=1258

# Integrate all departments
node scripts/integrateGPAData.js MATH 1258 1
node scripts/integrateGPAData.js CS 1258 1
node scripts/integrateGPAData.js PHYS 1258 1
```

## 🎯 **Features**

- ✅ **Generic Department Support** - Works with any UVA department
- ✅ **Term Filtering** - Filter courses by specific semester (e.g., --term=1258 for Fall 2025)
- ✅ **Unified Data Storage** - Single master CSV for all GPA data
- ✅ **Automatic Integration** - Seamlessly combines GPA and SIS data
- ✅ **Web Interface** - Browse courses with integrated information
- ✅ **Flexible Scraping** - Easy to add new departments

## 🚧 **Development**

### **Adding New Departments**
1. Find the department ID from theCourseForum
2. Run: `node scripts/scrapeCourseForum.js --departmentId=<ID> --subject=<CODE>`
3. Data automatically added to master CSV

### **Customizing Scraping**
- Modify `scrapeCourseForum.js` for department-specific logic
- Adjust timing and selectors as needed
- Add new data fields to the CSV schema

## 📝 **Notes**

- **Respectful Scraping**: Built-in delays to avoid overwhelming servers
- **Error Handling**: Robust error handling with fallback mechanisms
- **Data Validation**: Automatic validation and cleaning of scraped data
- **Performance**: Optimized for large datasets with efficient processing
- **Term Filtering**: Use --term argument to only scrape courses from specific semesters

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 **License**

MIT License - see LICENSE file for details.