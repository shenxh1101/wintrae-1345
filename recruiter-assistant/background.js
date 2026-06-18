const STORAGE_KEYS = {
  POSITIONS: 'ra_positions',
  CANDIDATES: 'ra_candidates',
  INTERVIEWS: 'ra_interviews',
  REMINDERS: 'ra_reminders'
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('checkReminders', { periodInMinutes: 1 });
  chrome.sidePanel.setOptions({ path: 'sidepanel/sidepanel.html' });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkReminders') {
    await checkAndNotifyReminders();
  }
});

async function checkAndNotifyReminders() {
  const reminders = await getData(STORAGE_KEYS.REMINDERS);
  const now = new Date().toISOString();
  const pending = reminders.filter(r => !r.completed && r.scheduledTime <= now);

  for (const reminder of pending) {
    chrome.notifications.create(reminder.id, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '招聘跟进提醒',
      message: `候选人 ${reminder.candidateName} - ${reminder.note || reminder.type}`,
      priority: 2
    });

    reminder.completed = true;
  }

  if (pending.length > 0) {
    await setData(STORAGE_KEYS.REMINDERS, reminders);
  }
}

function getData(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] || []);
    });
  });
}

function setData(key, data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: data }, resolve);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCRAPE_PAGE') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: scrapeCurrentPage
        }, (results) => {
          if (results && results[0]) {
            sendResponse(results[0].result);
          } else {
            sendResponse(null);
          }
        });
      }
    });
    return true;
  }

  if (message.type === 'CHECK_DUPLICATE') {
    getData(STORAGE_KEYS.CANDIDATES).then((candidates) => {
      const url = message.url;
      const duplicates = candidates.filter(c => c.pageUrl === url);
      sendResponse({ duplicates, count: duplicates.length });
    });
    return true;
  }

  if (message.type === 'OPEN_SIDEPANEL') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.sidePanel.open({ tabId: tabs[0].id });
      }
    });
    return true;
  }
});

function scrapeCurrentPage() {
  const data = {
    name: '',
    email: '',
    phone: '',
    currentCompany: '',
    links: [],
    pageUrl: window.location.href,
    pageTitle: document.title
  };

  const linkedInPatterns = [/linkedin\.com\/in\//i];
  const isLinkedIn = linkedInPatterns.some(p => p.test(window.location.href));

  if (isLinkedIn) {
    const nameEl = document.querySelector('h1') || document.querySelector('.text-heading-xlarge') || document.querySelector('[data-generated-suggestion-target]');
    if (nameEl) data.name = nameEl.textContent.trim();

    const companyEl = document.querySelector('.text-body-small.inline.t-black--break-words') ||
      document.querySelector('[aria-label="Current company"]');
    if (companyEl) data.currentCompany = companyEl.textContent.trim();

    const emailEl = document.querySelector('a[href^="mailto:"]');
    if (emailEl) data.email = emailEl.href.replace('mailto:', '').split('?')[0];

    const phoneEl = document.querySelector('a[href^="tel:"]');
    if (phoneEl) data.phone = phoneEl.href.replace('tel:', '');

    const linkEls = document.querySelectorAll('a[href]');
    const externalLinks = [];
    linkEls.forEach(el => {
      const href = el.href;
      if (href && !href.includes('linkedin.com') && !href.includes('javascript:') &&
          (href.includes('github.com') || href.includes('portfolio') || href.includes('behance.net') ||
           href.includes('dribbble.com') || href.includes('twitter.com') || href.includes('x.com') ||
           href.includes('medium.com') || href.includes('gitlab.com'))) {
        externalLinks.push({ text: el.textContent.trim(), url: href });
      }
    });
    data.links = externalLinks;
  } else {
    const nameSelectors = ['h1', '.name', '.candidate-name', '.profile-name', '[itemprop="name"]', '.person-name', '.resume-name'];
    for (const sel of nameSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 0 && el.textContent.trim().length < 100) {
        data.name = el.textContent.trim();
        break;
      }
    }

    const companySelectors = ['.company', '.current-company', '[itemprop="worksFor"]', '.employer', '.organization'];
    for (const sel of companySelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 0) {
        data.currentCompany = el.textContent.trim();
        break;
      }
    }

    const emailEl = document.querySelector('a[href^="mailto:"]');
    if (emailEl) data.email = emailEl.href.replace('mailto:', '').split('?')[0];

    const phoneEl = document.querySelector('a[href^="tel:"]');
    if (phoneEl) data.phone = phoneEl.href.replace('tel:', '');

    const bodyText = document.body.innerText || '';
    const emailMatch = bodyText.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
    if (!data.email && emailMatch) data.email = emailMatch[0];

    const phoneMatch = bodyText.match(/(?:\+?86[-\s]?)?1[3-9]\d{9}|(?:\+?1[-\s]?)?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}/);
    if (!data.phone && phoneMatch) data.phone = phoneMatch[0];

    const linkEls = document.querySelectorAll('a[href]');
    const externalLinks = [];
    const currentHost = window.location.hostname;
    linkEls.forEach(el => {
      const href = el.href;
      try {
        const url = new URL(href);
        if (url.hostname !== currentHost &&
            !href.includes('javascript:') &&
            !href.includes('facebook.com') && !href.includes('instagram.com') &&
            (href.includes('github.com') || href.includes('portfolio') || href.includes('behance.net') ||
             href.includes('dribbble.com') || href.includes('twitter.com') || href.includes('x.com') ||
             href.includes('medium.com') || href.includes('gitlab.com') || href.includes('linkedin.com') ||
             href.includes('zhipin.com') || href.includes('lagou.com') || href.includes('liepin.com'))) {
          externalLinks.push({ text: el.textContent.trim().substring(0, 50), url: href });
        }
      } catch (e) {}
    });
    const seenUrls = new Set();
    data.links = externalLinks.filter(l => {
      if (seenUrls.has(l.url)) return false;
      seenUrls.add(l.url);
      return true;
    }).slice(0, 10);
  }

  return data;
}
