const fs = require('fs');
const path = require('path');
const { ModernUIRenderer } = require('./renderModernUI');

class DepartmentViewRenderer {
  constructor() {
    this.renderer = new ModernUIRenderer();
  }

  // Render a department view with flexible data sources
  renderDepartmentView(options = {}) {
    const {
      term = '1258',
      subject = 'CS',
      page = '1',
      title = null,
      description = null,
      customDataPath = null,
      outputPath = null
    } = options;

    try {
      // Load data from specified path or default
      let dataPath = customDataPath;
      if (!dataPath) {
        dataPath = path.join(__dirname, '..', 'data', `integrated-term-${term}-subject-${subject}-page-${page}.json`);
      }

      if (!fs.existsSync(dataPath)) {
        throw new Error(`Data file not found: ${dataPath}`);
      }

      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      const courses = data.courses;

      // Use custom title/description or generate defaults
      const displayTitle = title || `${subject} Course Catalog`;
      const displayDescription = description || `Term ${term} • Page ${page} • ${courses.length} Courses`;

      // Generate HTML with custom metadata
      const html = this.renderer.render(term, subject, page, courses, {
        title: displayTitle,
        description: displayDescription
      });

      // Save to specified output path or default
      const finalOutputPath = outputPath || 
        path.join(__dirname, '..', 'output', `department-${subject}-term-${term}-page-${page}.html`);

      fs.writeFileSync(finalOutputPath, html);
      
      console.log(`✅ Department view rendered to: ${finalOutputPath}`);
      return finalOutputPath;

    } catch (error) {
      console.error('❌ Error rendering department view:', error.message);
      return null;
    }
  }

  // Render multiple departments/terms in batch
  renderBatch(renderJobs) {
    const results = [];
    
    console.log(`🚀 Starting batch render of ${renderJobs.length} views...`);
    
    renderJobs.forEach((job, index) => {
      console.log(`\n📄 Rendering ${index + 1}/${renderJobs.length}: ${job.subject} Term ${job.term}`);
      
      try {
        const result = this.renderDepartmentView(job);
        if (result) {
          results.push({ ...job, success: true, outputPath: result });
          console.log(`  ✅ Success: ${result}`);
        } else {
          results.push({ ...job, success: false, error: 'Render failed' });
          console.log(`  ❌ Failed`);
        }
      } catch (error) {
        results.push({ ...job, success: false, error: error.message });
        console.log(`  ❌ Error: ${error.message}`);
      }
    });

    // Generate summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`\n📊 Batch Render Summary:`);
    console.log(`  ✅ Successful: ${successful}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📁 Total: ${results.length}`);

    return results;
  }

  // Generate a department index page
  renderDepartmentIndex(departments) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>UVA Course Catalog - Department Index</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .department-card {
            transition: all 0.2s ease-in-out;
        }
        .department-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        }
    </style>
</head>
<body class="bg-gradient-to-br from-blue-600 to-purple-700 min-h-screen">
    <div class="container mx-auto px-4 py-8 max-w-6xl">
        <div class="text-center text-white mb-12">
            <h1 class="text-5xl font-bold mb-6">UVA Course Catalog</h1>
            <p class="text-xl opacity-90">Browse courses by department</p>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${departments.map(dept => `
                <div class="department-card bg-white rounded-2xl shadow-lg overflow-hidden">
                    <div class="p-6">
                        <h2 class="text-2xl font-bold text-gray-800 mb-2">${dept.subject}</h2>
                        <p class="text-gray-600 mb-4">${dept.name}</p>
                        
                        <div class="space-y-2 mb-6">
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-600">Available Terms:</span>
                                <span class="font-semibold">${dept.terms.join(', ')}</span>
                            </div>
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-600">Last Updated:</span>
                                <span class="font-semibold">${dept.lastUpdated}</span>
                            </div>
                        </div>
                        
                        <div class="space-y-2">
                            ${dept.terms.map(term => `
                                <a href="department-${dept.subject}-term-${term}-page-1.html" 
                                   class="block w-full bg-blue-500 hover:bg-blue-600 text-white text-center py-2 px-4 rounded-lg transition-colors">
                                    View Term ${term}
                                </a>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="mt-12 text-center text-white opacity-80">
            <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
    </div>
</body>
</html>`;

    const outputPath = path.join(__dirname, '..', 'output', 'department-index.html');
    fs.writeFileSync(outputPath, html);
    
    console.log(`✅ Department index rendered to: ${outputPath}`);
    return outputPath;
  }
}

// Example usage and CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const renderer = new DepartmentViewRenderer();

  switch (command) {
    case 'render':
      // Single department render
      const term = args.find(arg => arg.startsWith('--term='))?.split('=')[1] || '1258';
      const subject = args.find(arg => arg.startsWith('--subject='))?.split('=')[1] || 'CS';
      const page = args.find(arg => arg.startsWith('--page='))?.split('=')[1] || '1';
      
      renderer.renderDepartmentView({ term, subject, page });
      break;

    case 'batch':
      // Batch render multiple departments
      const renderJobs = [
        { term: '1258', subject: 'CS', page: '1' },
        { term: '1258', subject: 'MATH', page: '1' },
        { term: '1258', subject: 'PHYS', page: '1' }
      ];
      
      renderer.renderBatch(renderJobs);
      break;

    case 'index':
      // Generate department index
      const departments = [
        {
          subject: 'CS',
          name: 'Computer Science',
          terms: ['1258', '1256'],
          lastUpdated: 'Fall 2025'
        },
        {
          subject: 'MATH',
          name: 'Mathematics',
          terms: ['1258'],
          lastUpdated: 'Fall 2025'
        },
        {
          subject: 'PHYS',
          name: 'Physics',
          terms: ['1258'],
          lastUpdated: 'Fall 2025'
        }
      ];
      
      renderer.renderDepartmentIndex(departments);
      break;

    default:
      console.log(`
Usage: node renderDepartmentView.js <command> [options]

Commands:
  render [--term=1258] [--subject=CS] [--page=1]  Render single department view
  batch                                            Render multiple departments
  index                                            Generate department index page

Examples:
  node renderDepartmentView.js render --term=1258 --subject=CS --page=1
  node renderDepartmentView.js batch
  node renderDepartmentView.js index
      `);
  }
}

module.exports = DepartmentViewRenderer; 