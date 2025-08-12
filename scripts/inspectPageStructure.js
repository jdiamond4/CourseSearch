const puppeteer = require('puppeteer');

async function inspectPageStructure() {
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('🔍 Navigating to theCourseForum CS department...');
    
    await page.goto('https://thecourseforum.com/department/31/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait a bit for the page to fully load
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('📄 Page loaded, inspecting structure...');

    // Get the page title
    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Get all text content to see what's actually on the page
    const pageContent = await page.evaluate(() => {
      return document.body.innerText;
    });

    console.log('\n📝 Page content preview (first 1000 chars):');
    console.log(pageContent.substring(0, 1000));

    // Look for any elements that might contain course data
    const possibleSelectors = [
      'div', 'section', 'article', 'li', 'tr', '.course', '.class', '.item'
    ];

    console.log('\n🔍 Looking for course-related elements...');
    
    for (const selector of possibleSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} <${selector}> elements`);
          
          // Look at the first few elements to see their content
          for (let i = 0; i < Math.min(3, elements.length); i++) {
            const text = await page.evaluate(el => el.textContent?.trim().substring(0, 100), elements[i]);
            if (text && text.length > 10) {
              console.log(`  ${selector}[${i}]: ${text}...`);
            }
          }
        }
      } catch (error) {
        // Ignore errors for invalid selectors
      }
    }

    // Look for any links that might be course links
    const links = await page.$$('a');
    console.log(`\n🔗 Found ${links.length} links`);
    
    for (let i = 0; i < Math.min(5, links.length); i++) {
      try {
        const href = await page.evaluate(el => el.href, links[i]);
        const text = await page.evaluate(el => el.textContent?.trim(), links[i]);
        if (text && text.length > 0) {
          console.log(`  Link ${i}: "${text}" -> ${href}`);
        }
      } catch (error) {
        // Ignore errors
      }
    }

    // Take a screenshot to see what the page looks like
    await page.screenshot({ 
      path: 'page-screenshot.png', 
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as page-screenshot.png');

    // Get the HTML structure around the main content area
    const mainContentHTML = await page.evaluate(() => {
      const main = document.querySelector('main') || document.querySelector('.main') || document.body;
      return main.innerHTML.substring(0, 2000);
    });

    console.log('\n🏗️ Main content HTML structure (first 2000 chars):');
    console.log(mainContentHTML);

  } catch (error) {
    console.error('❌ Error inspecting page:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  inspectPageStructure();
} 