// Content script for parsing LinkedIn job pages
class LinkedInJobParser {
  constructor() {
    this.maxRetries = 10;
    this.retryDelay = 500;
  }

  async waitForJobDetails(retryCount = 0) {
    const jobDetailsPane = document.querySelector('[class*="job-details"]');
    
    if (jobDetailsPane && this.hasJobContent()) {
      return true;
    }
    
    if (retryCount >= this.maxRetries) {
      throw new Error('Job details pane did not load within timeout period');
    }
    
    await new Promise(resolve => setTimeout(resolve, this.retryDelay * Math.pow(1.2, retryCount)));
    return this.waitForJobDetails(retryCount + 1);
  }

  hasJobContent() {
    const title = this.extractJobTitle();
    const company = this.extractCompany();
    return title && company;
  }

  extractJobTitle() {
    // Primary selector - main job title in top card
    let titleElement = document.querySelector('[class*="job-title"]');
    if (titleElement) {
      const link = titleElement.querySelector('a');
      if (link && link.textContent.trim()) {
        return this.sanitizeText(link.textContent);
      }
    }

    // Fallback - sticky header
    titleElement = document.querySelector('[class*="sticky-header"] [class*="job-title"]');
    if (titleElement) {
      const text = titleElement.textContent || titleElement.innerText;
      if (text && text.trim()) {
        return this.sanitizeText(text);
      }
    }

    // Additional fallback - look for h1 elements
    const h1Elements = document.querySelectorAll('h1');
    for (const h1 of h1Elements) {
      const text = h1.textContent || h1.innerText;
      if (text && text.trim() && text.length > 5 && text.length < 200) {
        return this.sanitizeText(text);
      }
    }

    return null;
  }

  extractCompany() {
    // Primary selector
    let companyElement = document.querySelector('[class*="company-name"] a');
    if (companyElement && companyElement.textContent.trim()) {
      return this.sanitizeText(companyElement.textContent);
    }

    // Fallback without anchor
    companyElement = document.querySelector('[class*="company-name"]');
    if (companyElement && companyElement.textContent.trim()) {
      return this.sanitizeText(companyElement.textContent);
    }

    // Sticky header fallback
    companyElement = document.querySelector('[class*="sticky-header"] [class*="company"]');
    if (companyElement) {
      const link = companyElement.querySelector('a');
      if (link && link.textContent.trim()) {
        return this.sanitizeText(link.textContent);
      }
      if (companyElement.textContent.trim()) {
        return this.sanitizeText(companyElement.textContent);
      }
    }

    return null;
  }

  extractLocation() {
    // Look in tertiary description container
    const containers = document.querySelectorAll('[class*="tertiary-description"]');
    for (const container of containers) {
      const spans = container.querySelectorAll('span');
      for (const span of spans) {
        const text = span.textContent.trim();
        // Location is usually short and doesn't contain numbers or "ago"
        if (text && text.length > 2 && text.length < 50 && 
            !text.includes('ago') && !text.match(/^\d+/)) {
          return this.sanitizeText(text);
        }
      }
    }

    // Fallback - look for location indicators
    const locationElements = document.querySelectorAll('[class*="location"]');
    for (const element of locationElements) {
      const text = element.textContent.trim();
      if (text && text.length > 2 && text.length < 50) {
        return this.sanitizeText(text);
      }
    }

    return null;
  }

  extractPostedAge() {
    // Look for relative time indicators
    const containers = document.querySelectorAll('[class*="tertiary-description"], [class*="job-details"]');
    for (const container of containers) {
      const spans = container.querySelectorAll('span');
      for (const span of spans) {
        const text = span.textContent.trim();
        if (text.includes('ago') || text.match(/\d+\s*(day|hour|week|month)s?\s+ago/i)) {
          return this.sanitizeText(text);
        }
      }
    }

    return null;
  }

  extractApplicants() {
    // Look for premium insights or applicant indicators
    const elements = document.querySelectorAll('[class*="applicant"], [class*="premium-insight"], [class*="insight"]');
    for (const element of elements) {
      const text = element.textContent.trim();
      if (text.match(/\d+.*(?:applicant|total)/i)) {
        return this.sanitizeText(text);
      }
    }

    return null;
  }

  extractPay() {
    // Look for salary/compensation information
    const elements = document.querySelectorAll('[class*="fit-level"], [class*="salary"], [class*="compensation"]');
    for (const element of elements) {
      const text = element.textContent.trim();
      // Match currency patterns
      if (text.match(/(?:\$|€|£|CA\$|USD|EUR|GBP)[\d,]+(?:K|k)?(?:\s*-\s*(?:\$|€|£|CA\$|USD|EUR|GBP)?[\d,]+(?:K|k)?)?(?:\/(?:yr|year|hour|hr))?/i)) {
        return this.sanitizeText(text);
      }
    }

    return null;
  }

  extractDescription() {
    // Primary selector - job description content
    let descElement = document.querySelector('[class*="jobs-description__"] [class*="jobs-box__html-content"]');
    if (!descElement) {
      // Fallback selectors
      descElement = document.querySelector('[class*="job-description"]') ||
                   document.querySelector('[class*="description"] [class*="html-content"]') ||
                   document.querySelector('[class*="jobs-description"]');
    }

    if (descElement) {
      return this.sanitizeHtml(descElement.innerHTML);
    }

    return '';
  }

  sanitizeText(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  sanitizeHtml(html) {
    // Create a temporary element to work with
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove dangerous elements
    const dangerousElements = temp.querySelectorAll('script, iframe, object, embed, form');
    dangerousElements.forEach(el => el.remove());

    // Remove dangerous attributes
    const allElements = temp.querySelectorAll('*');
    allElements.forEach(el => {
      const attributes = [...el.attributes];
      attributes.forEach(attr => {
        if (attr.name.startsWith('on') || attr.name === 'style' && attr.value.includes('javascript:')) {
          el.removeAttribute(attr.name);
        }
      });
    });

    return temp.innerHTML;
  }

  async parseJobData() {
    try {
      await this.waitForJobDetails();

      const data = {
        sourceUrl: window.location.href,
        capturedAtIso: new Date().toISOString(),
        title: this.extractJobTitle(),
        company: this.extractCompany(),
        location: this.extractLocation(),
        pay: this.extractPay(),
        postedAge: this.extractPostedAge(),
        applicants: this.extractApplicants(),
        descriptionHtml: this.extractDescription()
      };

      // Validate required fields
      if (!data.title || !data.company) {
        throw new Error(`Missing required fields: ${!data.title ? 'title' : ''} ${!data.company ? 'company' : ''}`);
      }

      return data;
    } catch (error) {
      console.error('Failed to parse job data:', error);
      throw error;
    }
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PARSE_JOB_DATA') {
    const parser = new LinkedInJobParser();
    parser.parseJobData()
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }
});

// Initialize parser and make it available globally
window.linkedInJobParser = new LinkedInJobParser();