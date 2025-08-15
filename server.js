const express = require('express');
const path = require('path');
const fs = require('fs').promises;

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
  if (!time || time === 0) return 'TBA';
  
  const timeStr = time.toString().padStart(4, '0');
  const hours = parseInt(timeStr.substring(0, 2));
  const minutes = timeStr.substring(2, 4);
  
  if (hours === 0) return `12:${minutes} AM`;
  if (hours < 12) return `${hours}:${minutes} AM`;
  if (hours === 12) return `12:${minutes} PM`;
  return `${hours - 12}:${minutes} PM`;
};

// Routes
app.get('/', (req, res) => {
    res.render('landing', { title: 'UVA Course Search' });
});

app.get('/catalog', async (req, res) => {
    try {
        const { department, filters } = req.query;
        
        // For now, use the existing CS data
        let courses = [];
        
        if (department === 'CS') {
            const dataPath = path.join(__dirname, 'data', 'integrated-term-1258-subject-CS-page-1.json');
            try {
                const data = await fs.readFile(dataPath, 'utf8');
                const courseData = JSON.parse(data);
                courses = courseData.courses;
            } catch (fileError) {
                console.log(`CS data file not found: ${dataPath}`);
                courses = [];
            }
        }
        
        // Generate dynamic title based on what's being displayed
        let title = 'Course Catalog';
        if (department) {
            title = `${department} Courses`;
        }
        
        res.render('catalog', { 
            courses, 
            department,
            filters,
            title
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 Course catalog: http://localhost:${PORT}/courses/CS/1258`);
  console.log(`🔍 API endpoint: http://localhost:${PORT}/api/courses/CS/1258`);
}); 