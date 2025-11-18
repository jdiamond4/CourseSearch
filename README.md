# HoosList: Smart Course Discovery for UVA Students

## My Mission

My goal is to build a smarter, more modern course search solution that goes beyond basic course catalogs. This is going to be a platform that helps UVA students make informed decisions by comparing not just typical course information, but also instructor GPAs and ratings to find the best learning experience. I found that this was the most important yet unknown piece of information about courses yet it was always so hard to quickly find and compare to the course options open during enrollment. 

## What We're Building

### Current Features
- **Smart Course Filtering**: Search by department, course level, enrollment status, and instructor GPA
- **Real-time Data**: Live enrollment information and up-to-date course details via GitHub Actions automation
- **GPA Integration**: See instructor ratings and GPAs from theCourseForum.com
- **My Schedule**: Build and save your course schedule with visual calendar integration
- **Favorites System**: Save courses to your favorites for quick access during enrollment
- **Modern Interface**: Clean, intuitive design with UVA branding (Navy & Orange)
- **Multi-Department Categories**: Browse related departments together (e.g., Quantitative Sciences, Romance Languages)
- **Dynamic Landing Page**: CSV-driven button configuration for easy customization
- **Pagination**: Efficient browsing through large course catalogs
- **Automated Updates**: GitHub Actions workflows keep course data fresh throughout the day

### Future Vision
- **AI-Powered Recommendations**: Custom searches that fit your specific schedule and preferences
- **Smart Scheduling**: Intelligent suggestions based on your academic goals and time constraints

## Data Management

This project uses MongoDB Atlas for course data storage with local CSV files for GPA data:

- **MongoDB Atlas**: Cloud-hosted database for course data (sections, discussions, enrollment)
- **Local CSV Files**: GPA data stored in `localdata/master-gpa-data.csv`
- **Hybrid Approach**: Course data in MongoDB, GPA data merged on server-side

### Benefits
- **Real-time Updates**: MongoDB allows for instant course data updates
- **Scalability**: Cloud database handles thousands of courses efficiently
- **Flexibility**: CSV fallback system ensures reliability
- **Fast Queries**: MongoDB indexing for quick filtering and searching

### Updating Data

Data is automatically updated via GitHub Actions workflows that run throughout the day to keep course information current. For manual updates, see `COMMANDS.md` for detailed data management commands.
- **Predictive Analytics**: Course difficulty predictions and success rate insights
- **Personalized Experience**: Learning from your preferences to suggest better course combinations

## Why This Matters

### For Students
- **Make Better Decisions**: Compare courses beyond just descriptions and times
- **Find Great Instructors**: See actual student feedback and GPA data
- **Optimize Your Schedule**: Build a course load that fits your learning style
- **Save Time**: No more digging through multiple websites for course information

### For the UVA Community
- **Transparency**: Open access to course and instructor data
- **Data-Driven Choices**: Evidence-based course selection

## How It Works

### Data Sources
- **SIS Integration**: Real-time course data from UVA's Student Information System
- **GPA Data**: Instructor ratings and GPAs from theCourseForum.com
- **Live Updates**: Enrollment data refreshed every few minutes during peak periods

### Smart Filtering
- **Department & Level**: Find courses in your major or explore new subjects
- **Enrollment Status**: See what's actually available right now
- **Instructor Quality**: Filter by minimum GPA thresholds (3.8+, 3.5+, 3.0+, 2.5+)
- **Combined Searches**: Mix and match filters for precise results
- **Category Browsing**: Explore related departments together

### Future AI Integration
- **Natural Language Queries**: "Find me a 3000-level CS course with a good professor that fits my Tuesday/Thursday schedule"
- **Learning Preferences**: AI learns what you value in courses and instructors
- **Schedule Optimization**: Intelligent suggestions that work with your existing commitments

## Our Goals

### Completed
- [x] Built comprehensive course database with live enrollment data
- [x] Integrated instructor GPA and rating information
- [x] Created intuitive search and filtering interface
- [x] Support for all UVA departments and course levels
- [x] Multi-department category browsing
- [x] CSV-driven landing page configuration
- [x] Pagination for large course catalogs
- [x] Official UVA branding (HoosList)
- [x] Migrated from CSV to MongoDB Atlas for scalability
- [x] Hybrid data storage (MongoDB + local GPA CSV)
- [x] Automated MongoDB data updates via GitHub Actions
- [x] My Schedule feature with calendar visualization
- [x] Course favorites system
- [x] Successfully served 300+ users during live enrollment

### In Progress
- [ ] Course comparison tools and visualizations
- [ ] Enhanced filtering options and saved searches
- [ ] Performance optimizations for peak traffic

### Future Development
- [ ] AI-powered course recommendations
- [ ] Smart scheduling assistant
- [ ] Predictive course difficulty and success rates
- [ ] Integration with SIS for personalized degree tracking
- [ ] Mobile app for on-the-go course discovery

## Technology Stack

- **Backend**: Node.js with Express.js
- **Database**: MongoDB Atlas (cloud-hosted)
- **Data Storage**: Hybrid MongoDB + local CSV files
- **Frontend**: EJS templating with Tailwind CSS
- **User Features**: My Schedule calendar integration and favorites system
- **Data Sources**: UVA SIS API + theCourseForum.com
- **Automation**: GitHub Actions for scheduled data updates
- **Scraping**: Playwright for automated GPA data collection
- **Real-time Data**: Live enrollment updates from SIS API
- **Smart Filtering**: MongoDB queries with server-side GPA merging
- **Production Ready**: Served over 300 users during live enrollment with real-time data updates

## Get Started

Visit our url coming soon to start discovering courses smarter.

### Quick Start
1. **Choose Your Department**: CS, Math, Physics, or browse all
2. **Set Your Preferences**: Course level, enrollment status, instructor quality
3. **Find Your Courses**: Get personalized results with GPA insights
4. **Save Favorites**: Star courses you're interested in for quick access
5. **Build Your Schedule**: Add courses to My Schedule with calendar visualization

### Browse Categories
- **Quantitative Sciences**: Computer Science, Mathematics
- **Romance Languages**: Spanish, Italian, Portuguese
- **Individual Departments**: Astronomy, Statistics, Buddhism, and more

## Questions?

If you have any questions about HoosList, feel free to reach out at pyb4xe@virginia.edu

Justin Diamond  
UVA 2028