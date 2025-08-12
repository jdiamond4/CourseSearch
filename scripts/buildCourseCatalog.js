const fs = require('fs');
const path = require('path');
const DepartmentViewRenderer = require('./renderDepartmentView');

class CourseCatalogBuilder {
  constructor() {
    this.config = this.loadConfig();
    this.renderer = new DepartmentViewRenderer();
  }

  // Load department configuration
  loadConfig() {
    try {
      const configPath = path.join(__dirname, '..', 'config', 'departments.json');
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.error('❌ Error loading config:', error.message);
      return { departments: [], globalSettings: {} };
    }
  }

  // Build the entire course catalog
  async buildCatalog(options = {}) {
    const {
      departments = this.config.departments,
      terms = null,
      skipGPA = false,
      generateIndex = true
    } = options;

    console.log('🚀 Starting Course Catalog Build...\n');

    const results = [];
    const totalJobs = departments.length;

    for (let i = 0; i < departments.length; i++) {
      const dept = departments[i];
      console.log(`📚 Processing ${i + 1}/${totalJobs}: ${dept.subject} - ${dept.name}`);

      // Process each term for this department
      const termsToProcess = terms || dept.terms;
      
      for (const term of termsToProcess) {
        try {
          console.log(`  📅 Processing Term ${term}...`);
          
          // Check if data exists
          const dataPath = path.join(__dirname, '..', 'data', `integrated-term-${term}-subject-${dept.subject}-page-1.json`);
          
          if (!fs.existsSync(dataPath)) {
            console.log(`    ⚠️ No data found for ${dept.subject} Term ${term}, skipping...`);
            continue;
          }

          // Render department view
          const outputPath = await this.renderer.renderDepartmentView({
            term,
            subject: dept.subject,
            page: '1',
            title: `${dept.name} Course Catalog`,
            description: `${dept.description} • Term ${term}`,
            outputPath: path.join(__dirname, '..', 'output', `department-${dept.subject}-term-${term}-page-1.html`)
          });

          if (outputPath) {
            results.push({
              department: dept.subject,
              term,
              success: true,
              outputPath,
              gpaData: dept.gpaDataAvailable
            });
            console.log(`    ✅ Rendered: ${path.basename(outputPath)}`);
          } else {
            results.push({
              department: dept.subject,
              term,
              success: false,
              error: 'Render failed'
            });
            console.log(`    ❌ Render failed`);
          }

        } catch (error) {
          console.log(`    ❌ Error: ${error.message}`);
          results.push({
            department: dept.subject,
            term,
            success: false,
            error: error.message
          });
        }
      }
    }

    // Generate department index if requested
    if (generateIndex) {
      console.log('\n📋 Generating department index...');
      try {
        const indexPath = await this.renderer.renderDepartmentIndex(departments);
        console.log(`✅ Department index: ${path.basename(indexPath)}`);
      } catch (error) {
        console.log(`❌ Index generation failed: ${error.message}`);
      }
    }

    // Generate build summary
    this.generateBuildSummary(results);
    
    return results;
  }

  // Generate a comprehensive build summary
  generateBuildSummary(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const total = results.length;

    console.log('\n' + '='.repeat(60));
    console.log('📊 COURSE CATALOG BUILD SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n✅ Successful Renders: ${successful.length}/${total}`);
    successful.forEach(result => {
      console.log(`  • ${result.department} Term ${result.term} ${result.gpaData ? '(with GPA)' : ''}`);
    });

    if (failed.length > 0) {
      console.log(`\n❌ Failed Renders: ${failed.length}/${total}`);
      failed.forEach(result => {
        console.log(`  • ${result.department} Term ${result.term}: ${result.error}`);
      });
    }

    console.log(`\n📁 Output Directory: ${path.join(__dirname, '..', 'output')}`);
    console.log(`📅 Build Completed: ${new Date().toLocaleString()}`);
    console.log('='.repeat(60));

    // Save build log
    const buildLog = {
      buildDate: new Date().toISOString(),
      totalJobs: total,
      successful: successful.length,
      failed: failed.length,
      results: results
    };

    const logPath = path.join(__dirname, '..', 'output', `build-log-${Date.now()}.json`);
    fs.writeFileSync(logPath, JSON.stringify(buildLog, null, 2));
    console.log(`\n📝 Build log saved to: ${path.basename(logPath)}`);
  }

  // Quick build for a single department
  async buildDepartment(subject, term = null) {
    const dept = this.config.departments.find(d => d.subject === subject);
    if (!dept) {
      throw new Error(`Department ${subject} not found in configuration`);
    }

    const termsToProcess = term ? [term] : dept.terms;
    
    return await this.buildCatalog({
      departments: [dept],
      terms: termsToProcess,
      generateIndex: false
    });
  }

  // Build all departments for a specific term
  async buildTerm(term) {
    return await this.buildCatalog({
      terms: [term],
      generateIndex: true
    });
  }

  // Validate configuration
  validateConfig() {
    const errors = [];
    
    if (!this.config.departments || this.config.departments.length === 0) {
      errors.push('No departments configured');
    }

    this.config.departments.forEach((dept, index) => {
      if (!dept.subject) errors.push(`Department ${index}: Missing subject code`);
      if (!dept.name) errors.push(`Department ${index}: Missing name`);
      if (!dept.terms || dept.terms.length === 0) errors.push(`Department ${index}: No terms configured`);
    });

    if (errors.length > 0) {
      console.log('❌ Configuration validation failed:');
      errors.forEach(error => console.log(`  • ${error}`));
      return false;
    }

    console.log('✅ Configuration validation passed');
    return true;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const builder = new CourseCatalogBuilder();

  // Validate config first
  if (!builder.validateConfig()) {
    process.exit(1);
  }

  switch (command) {
    case 'build':
      // Build entire catalog
      builder.buildCatalog();
      break;

    case 'department':
      // Build specific department
      const subject = args.find(arg => arg.startsWith('--subject='))?.split('=')[1];
      const term = args.find(arg => arg.startsWith('--term='))?.split('=')[1];
      
      if (!subject) {
        console.log('❌ Please specify --subject=CODE');
        process.exit(1);
      }
      
      builder.buildDepartment(subject, term);
      break;

    case 'term':
      // Build all departments for specific term
      const termCode = args.find(arg => arg.startsWith('--term='))?.split('=')[1];
      
      if (!termCode) {
        console.log('❌ Please specify --term=CODE');
        process.exit(1);
      }
      
      builder.buildTerm(termCode);
      break;

    case 'validate':
      // Just validate configuration
      builder.validateConfig();
      break;

    default:
      console.log(`
Usage: node buildCourseCatalog.js <command> [options]

Commands:
  build                                    Build entire course catalog
  department --subject=CS [--term=1258]   Build specific department
  term --term=1258                        Build all departments for term
  validate                                 Validate configuration

Examples:
  node buildCourseCatalog.js build
  node buildCourseCatalog.js department --subject=CS --term=1258
  node buildCourseCatalog.js term --term=1258
  node buildCourseCatalog.js validate
      `);
  }
}

module.exports = CourseCatalogBuilder; 