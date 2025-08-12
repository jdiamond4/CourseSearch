const puppeteer = require('puppeteer');

async function debugLinks() {
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null
  });
  
  const page = await browser.newPage();
  
  try {
    console.log('🔍 Debugging links on CourseForum CS department page...');
    
    await page.goto('https://thecourseforum.com/department/31/?page=1', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('📄 Page loaded, examining all links...');

    // Get all links and their text
    const links = await page.evaluate(() => {
      const allLinks = document.querySelectorAll('a');
      const linkInfo = [];
      
      allLinks.forEach((link, index) => {
        const text = link.textContent?.trim();
        const href = link.href;
        const className = link.className;
        const isVisible = link.offsetParent !== null;
        
        if (text && text.length > 0) {
          linkInfo.push({
            index,
            text: text.substring(0, 100),
            href: href.substring(0, 100),
            className: className,
            isVisible
          });
        }
      });
      
      return linkInfo;
    });

    console.log(`\n🔗 Found ${links.length} links:`);
    links.forEach(link => {
      console.log(`  ${link.index}: "${link.text}" -> ${link.href}`);
      console.log(`     Class: "${link.className}" (visible: ${link.isVisible})`);
    });

    // Look specifically for rating-card-link class
    console.log('\n🎯 Looking for rating-card-link class...');
    const ratingCardLinks = links.filter(link => 
      link.className.includes('rating-card-link')
    );
    
    if (ratingCardLinks.length > 0) {
      console.log(`\n✅ Found ${ratingCardLinks.length} rating-card-link elements:`);
      ratingCardLinks.forEach(link => {
        console.log(`  "${link.text}" -> ${link.href}`);
      });
    } else {
      console.log('\n⚠️ No rating-card-link elements found');
      
      // Look for any links that might be course links
      console.log('\n🔍 Looking for potential course links...');
      const potentialCourseLinks = links.filter(link => 
        link.href.includes('/course/') || 
        link.text.includes('CS ') ||
        link.text.includes('Introduction to Programming')
      );
      
      if (potentialCourseLinks.length > 0) {
        console.log(`\n📚 Found ${potentialCourseLinks.length} potential course links:`);
        potentialCourseLinks.forEach(link => {
          console.log(`  "${link.text}" -> ${link.href} (class: "${link.className}")`);
        });
      }
    }

    // Look for any elements with 'rating' in the class name
    console.log('\n🔍 Looking for elements with "rating" in class name...');
    const ratingElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('*[class*="rating"]');
      const elementInfo = [];
      
      elements.forEach((el, index) => {
        const tagName = el.tagName.toLowerCase();
        const className = el.className;
        const text = el.textContent?.trim().substring(0, 50);
        
        elementInfo.push({
          index,
          tagName,
          className,
          text
        });
      });
      
      return elementInfo;
    });
    
    if (ratingElements.length > 0) {
      console.log(`\n📊 Found ${ratingElements.length} elements with "rating" in class:`);
      ratingElements.forEach(el => {
        console.log(`  ${el.tagName}: "${el.text}" (class: "${el.className}")`);
      });
    }

    // Take a screenshot
    await page.screenshot({ 
      path: 'debug-links-screenshot.png', 
      fullPage: true 
    });
    console.log('\n📸 Screenshot saved as debug-links-screenshot.png');

  } catch (error) {
    console.error('❌ Error debugging links:', error);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  debugLinks();
} 