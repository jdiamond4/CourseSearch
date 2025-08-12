const fs = require('fs');
const path = require('path');

// Modern UI Renderer with modular components
class ModernUIRenderer {
  constructor() {
    this.components = {
      header: this.renderHeader.bind(this),
      statsBar: this.renderStatsBar.bind(this),
      courseCard: this.renderCourseCard.bind(this),
      sectionItem: this.renderSectionItem.bind(this),
      discussionItem: this.renderDiscussionItem.bind(this)
    };
  }

  // Main render function
  render(term, subject, page, courses) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject} Courses - Term ${term}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .course-card {
            transition: all 0.2s ease-in-out;
            background: #f8fafc;
            border: 2px solid #e2e8f0;
        }
        .course-card:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border-color: #3b82f6;
        }
        .section-item {
            border-left: 4px solid #3b82f6;
            background: #ffffff;
            border: 1px solid #e2e8f0;
        }
        .discussion-item {
            border-left: 4px solid #10b981;
            background: #ffffff;
            border: 1px solid #e2e8f0;
        }
        .gpa-badge {
            background: linear-gradient(135deg, #4CAF50, #45a049);
            color: white;
            padding: 0.2rem 0.4rem;
            border-radius: 0.375rem;
            font-size: 0.75rem;
            font-weight: 600;
        }
        .gpa-na {
            color: #64748b;
            font-style: italic;
            font-size: 0.75rem;
            background: #f1f5f9;
            padding: 0.1rem 0.3rem;
            border-radius: 0.25rem;
        }
        .enrollment-badge {
            padding: 0.3rem 0.6rem;
            border-radius: 0.5rem;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .enrollment-open { background: #dcfce7; color: #166534; border: 2px solid #bbf7d0; }
        .enrollment-full { background: #fee2e2; color: #991b1b; border: 2px solid #fecaca; }
        .enrollment-waitlist { background: #fef3c7; color: #92400e; border: 2px solid #fde68a; }
    </style>
</head>
<body class="bg-slate-100 min-h-screen">
    <div class="container mx-auto px-4 py-6 max-w-7xl">
        ${this.components.header(term, subject, page, courses.length)}
        ${this.components.statsBar(courses)}
        
        <div class="space-y-4">
            ${courses.map(course => this.components.courseCard(course)).join('')}
        </div>
    </div>
    
    <script>
        // Search/filter functionality
        document.getElementById('courseSearch').addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            document.querySelectorAll('.course-card').forEach(card => {
                const courseText = card.textContent.toLowerCase();
                if (courseText.includes(searchTerm)) {
                    card.classList.remove('hidden');
                } else {
                    card.classList.add('hidden');
                }
            });
        });
    </script>
</body>
</html>`;

    return html;
  }

  // Header component
  renderHeader(term, subject, page, courseCount) {
    return `
    <div class="text-center mb-6">
        <h1 class="text-3xl font-bold text-gray-800 mb-2">${subject} Course Catalog</h1>
        <p class="text-gray-600">Term ${term} • ${courseCount} Courses</p>
        
        <div class="mt-4 max-w-md mx-auto">
            <input 
                type="text" 
                id="courseSearch" 
                placeholder="Search courses..." 
                class="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
        </div>
    </div>`;
  }

  // Stats bar component
  renderStatsBar(courses) {
    const totalSections = courses.reduce((sum, c) => sum + c.sections.length, 0);
    const totalDiscussions = courses.reduce((sum, c) => sum + c.discussions.length, 0);
    
    return `
    <div class="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg p-6 mb-6 shadow-lg text-white">
        <h3 class="text-lg font-semibold mb-4 text-center">Course Statistics</h3>
        <div class="grid grid-cols-3 gap-4 text-center">
            <div class="bg-white/20 rounded-lg p-3">
                <div class="text-3xl font-bold">${courses.length}</div>
                <div class="text-sm opacity-90">Courses</div>
            </div>
            <div class="bg-white/20 rounded-lg p-3">
                <div class="text-3xl font-bold">${totalSections}</div>
                <div class="text-sm opacity-90">Sections</div>
            </div>
            <div class="bg-white/20 rounded-lg p-3">
                <div class="text-3xl font-bold">${totalDiscussions}</div>
                <div class="text-sm opacity-90">Discussions</div>
            </div>
        </div>
    </div>`;
  }

  // Course card component
  renderCourseCard(course) {
    const hasAvailableSeats = course.sections.some(s => s.currentEnrollment < s.maxEnrollment);
    const statusClass = hasAvailableSeats ? 'bg-green-500' : 'bg-red-500';
    const statusText = hasAvailableSeats ? 'OPEN' : 'FULL';
    
    const totalEnrollment = course.sections.reduce((sum, s) => sum + s.currentEnrollment, 0);
    const totalCapacity = course.sections.reduce((sum, s) => sum + s.maxEnrollment, 0);
    const avgGPA = this.getAverageGPA(course);
    
    return `
    <div class="course-card bg-white rounded-lg shadow-sm border border-gray-200">
        <div class="p-4">
                    <!-- Course Header Row - Table-like layout -->
        <div class="grid grid-cols-6 gap-4 items-center mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div class="col-span-2">
                <h2 class="text-lg font-bold text-blue-800">${course.mnemonic} ${course.number}</h2>
                <p class="text-sm text-blue-600 font-medium">${course.title || 'No title available'}</p>
            </div>
            <div class="text-center">
                <div class="text-lg font-bold text-blue-800">${totalEnrollment}/${totalCapacity}</div>
                <div class="text-xs text-blue-600 font-medium">Enrolled</div>
            </div>
            <div class="text-center">
                <div class="text-lg font-bold text-blue-800">${course.sections.length}</div>
                <div class="text-xs text-blue-600 font-medium">Lectures</div>
            </div>
            <div class="text-center">
                <div class="text-lg font-bold text-blue-800">${course.discussions.length}</div>
                <div class="text-xs text-blue-600 font-medium">Discussions</div>
            </div>
            <div class="text-center">
                <div class="text-lg font-bold text-blue-800">${avgGPA}</div>
                <div class="text-xs text-blue-600 font-medium">Avg GPA</div>
            </div>
        </div>
            
                    <!-- Simple Table Headers -->
        <div class="mb-3">
            <div class="grid grid-cols-8 gap-3 px-3 py-2 bg-gray-100 rounded text-xs font-semibold text-gray-700">
                <div>Section</div>
                <div class="text-center">Status</div>
                <div class="text-center">Enrollment</div>
                <div class="text-center">Instructor</div>
                <div class="text-center">Time</div>
                <div class="text-center">Days</div>
                <div class="text-center">Location</div>
                <div class="text-center">GPA</div>
            </div>
        </div>
        
        ${this.renderSections(course)}
        ${this.renderDiscussions(course)}
        </div>
    </div>`;
  }

  // Sections component
  renderSections(course) {
    if (course.sections.length === 0) return '';
    
    return `
    <div class="mb-4">
        <h3 class="text-sm font-semibold text-blue-700 mb-3 flex items-center">
            <span class="mr-2">📚</span>
            Lectures (${course.sections.length})
        </h3>
        <div class="space-y-1">
            ${course.sections.map(section => this.renderSectionItem(section)).join('')}
        </div>
    </div>`;
  }

  // Discussions component
  renderDiscussions(course) {
    if (course.discussions.length === 0) return '';
    
    const type = this.getDiscussionType(course.discussions[0]);
    return `
    <div class="mb-4">
        <h3 class="text-sm font-semibold text-green-700 mb-3 flex items-center">
            <span class="mr-2">${this.getDiscussionIcon(type)}</span>
            ${type}s (${course.discussions.length})
        </h3>
        <div class="space-y-1">
            ${course.discussions.map(discussion => this.renderDiscussionItem(discussion)).join('')}
        </div>
    </div>`;
  }

  // Section item component
  renderSectionItem(section) {
    const enrollmentClass = this.getEnrollmentClass(section.currentEnrollment, section.maxEnrollment);
    const enrollmentText = this.getEnrollmentText(section.currentEnrollment, section.maxEnrollment);
    
    return `
    <div class="section-item bg-white rounded p-3 border-l-4 border-blue-500 hover:bg-blue-50 transition-colors">
        <div class="grid grid-cols-8 gap-3 items-center text-sm">
            <div class="font-semibold text-blue-800">${section.sectionNumber}</div>
            <div class="text-center">
                <span class="enrollment-badge ${enrollmentClass} text-xs">${enrollmentText}</span>
            </div>
            <div class="text-center font-medium text-gray-800">${section.currentEnrollment}/${section.maxEnrollment}</div>
            <div class="text-center font-medium text-gray-800">${section.teacherName}</div>
            <div class="text-center text-gray-700">${this.formatTime(section.startTime)} - ${this.formatTime(section.endTime)}</div>
            <div class="text-center text-gray-700">${section.days.join(' ') || 'TBA'}</div>
            <div class="text-center text-gray-700">${section.location}</div>
            <div class="text-center">
                ${section.instructorGPA && section.instructorGPA !== 'N/A' ? 
                  `<span class="gpa-badge">${section.instructorGPA}</span>` : 
                  '<span class="gpa-na">N/A</span>'}
            </div>
        </div>
    </div>`;
  }

  // Discussion item component
  renderDiscussionItem(discussion) {
    const enrollmentClass = this.getEnrollmentClass(discussion.currentEnrollment, discussion.maxEnrollment);
    const enrollmentText = this.getEnrollmentText(discussion.currentEnrollment, discussion.maxEnrollment);
    
    return `
    <div class="discussion-item bg-white rounded p-3 border-l-4 border-green-500 hover:bg-green-50 transition-colors">
        <div class="grid grid-cols-8 gap-3 items-center text-sm">
            <div class="font-semibold text-green-800">${discussion.sectionNumber}</div>
            <div class="text-center">
                <span class="enrollment-badge ${enrollmentClass} text-xs">${enrollmentText}</span>
            </div>
            <div class="text-center font-medium text-gray-800">${discussion.currentEnrollment}/${discussion.maxEnrollment}</div>
            <div class="text-center font-medium text-gray-800">${discussion.teacherName}</div>
            <div class="text-center text-gray-700">${this.formatTime(discussion.startTime)} - ${this.formatTime(discussion.endTime)}</div>
            <div class="text-center text-gray-700">${discussion.days.join(' ') || 'TBA'}</div>
            <div class="text-center text-gray-700">${discussion.location}</div>
            <div class="text-center text-gray-400">—</div>
        </div>
    </div>`;
  }

  // Utility methods
  getEnrollmentClass(current, max) {
    if (max === 0) return 'enrollment-waitlist';
    if (current >= max) return 'enrollment-full';
    return 'enrollment-open';
  }

  getEnrollmentText(current, max) {
    if (max === 0) return 'Waitlist';
    if (current >= max) return 'Full';
    return 'Open';
  }

  formatTime(time24) {
    if (time24 === 0) return 'TBA';
    const hours = Math.floor(time24 / 100);
    const minutes = time24 % 100;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  getDiscussionIcon(type) {
    const iconMap = {
      'Lab': '🧪',
      'Discussion': '💬',
      'Independent Study': '📚',
      'Practicum': '🔬',
      'Seminar': '🎓'
    };
    return iconMap[type] || '📝';
  }

  getDiscussionType(discussion) {
    return discussion.type || 'Discussion';
  }

  getAverageGPA(course) {
    const sectionsWithGPA = course.sections.filter(s => s.instructorGPA && s.instructorGPA !== 'N/A');
    if (sectionsWithGPA.length === 0) return 'N/A';
    
    const totalGPA = sectionsWithGPA.reduce((sum, s) => sum + parseFloat(s.instructorGPA), 0);
    return (totalGPA / sectionsWithGPA.length).toFixed(2);
  }
}

// Main render function
function renderModernUI(term, subject, page) {
  try {
    // Load integrated data (with GPA) if available, otherwise fall back to organized data
    let dataPath = path.join(__dirname, '..', 'data', `integrated-term-${term}-subject-${subject}-page-${page}.json`);
    let integratedData = null;
    
    if (fs.existsSync(dataPath)) {
      integratedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      console.log('✅ Using integrated data with GPA information');
    } else {
      dataPath = path.join(__dirname, '..', 'data', `organized-term-${term}-subject-${subject}-page-${page}.json`);
      if (!fs.existsSync(dataPath)) {
        console.error(`No data found for term ${term}, subject ${subject}, page ${page}`);
        console.log('Please run processAndOrganize.js first to organize the data.');
        return;
      }
      integratedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      console.log('⚠️ Using organized data without GPA information');
    }
    
    const courses = integratedData.courses;
    const renderer = new ModernUIRenderer();
    const html = renderer.render(term, subject, page, courses);

    // Save the HTML file
    const outputPath = path.join(__dirname, '..', 'output', `modern-ui-term-${term}-subject-${subject}-page-${page}.html`);
    fs.writeFileSync(outputPath, html);
    
    console.log(`✅ Modern UI rendered to: ${outputPath}`);
    return outputPath;
    
  } catch (error) {
    console.error('Error rendering modern UI:', error);
  }
}

// Export for use as module
module.exports = { renderModernUI, ModernUIRenderer };

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const term = args.find(arg => arg.startsWith('--term='))?.split('=')[1];
  const subject = args.find(arg => arg.startsWith('--subject='))?.split('=')[1];
  const page = args.find(arg => arg.startsWith('--page='))?.split('=')[1];
  
  if (!term || !subject || !page) {
    console.log('Usage: node renderModernUI.js --term=1258 --subject=CS --page=1');
    process.exit(1);
  }
  
  renderModernUI(term, subject, page);
} 