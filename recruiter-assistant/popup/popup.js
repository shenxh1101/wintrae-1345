const STATUS_MAP = {
  new: { text: '新候选人', class: 'badge-new' },
  phone_screen: { text: '电话筛选', class: 'badge-phone_screen' },
  interviewing: { text: '面试中', class: 'badge-interviewing' },
  offered: { text: '已发offer', class: 'badge-offered' },
  rejected: { text: '已淘汰', class: 'badge-rejected' },
  hired: { text: '已录用', class: 'badge-hired' }
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

async function loadStats() {
  const positions = await getPositions();
  const candidates = await getCandidates();
  const interviews = await getInterviews();
  const reminders = await getReminders();
  const pendingReminders = reminders.filter(r => !r.completed);

  const el = (hook) => document.querySelector(`[data-hook="${hook}"]`);
  if (el('stat-positions')) el('stat-positions').textContent = positions.length;
  if (el('stat-candidates')) el('stat-candidates').textContent = candidates.length;
  if (el('stat-interviews')) el('stat-interviews').textContent = interviews.length;
  if (el('stat-reminders')) el('stat-reminders').textContent = pendingReminders.length;

  const sorted = [...candidates].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const list = document.querySelector('[data-hook="recent-list"]');
  const section = document.querySelector('[data-hook="recent-section"]');

  if (sorted.length === 0) {
    if (section) section.hidden = true;
    return;
  }

  if (section) section.hidden = false;

  if (list) {
    list.innerHTML = sorted.map(c => {
      const status = STATUS_MAP[c.status] || STATUS_MAP.new;
      return `
        <li class="recent-item">
          <span class="recent-item-name">${escapeHtml(c.name)}</span>
          ${c.currentCompany ? `<span class="recent-item-company">${escapeHtml(c.currentCompany)}</span>` : ''}
          <span class="recent-item-badge ${status.class}">${status.text}</span>
        </li>`;
    }).join('');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadStats();

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    switch (btn.dataset.action) {
      case 'open-sidepanel':
        if (tab) chrome.sidePanel.open({ tabId: tab.id });
        window.close();
        break;
      case 'quick-scrape':
        chrome.runtime.sendMessage({ type: 'SCRAPE_PAGE' }, (response) => {
          if (response && tab) {
            chrome.sidePanel.open({ tabId: tab.id });
            setTimeout(() => {
              chrome.runtime.sendMessage({
                type: 'OPEN_CANDIDATE_WITH_SCRAPE',
                data: response
              });
            }, 300);
          }
        });
        window.close();
        break;
      case 'add-candidate-quick':
        if (tab) chrome.sidePanel.open({ tabId: tab.id });
        window.close();
        break;
    }
  });
});
