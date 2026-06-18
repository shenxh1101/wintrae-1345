const STATUS_MAP = {
  new: { text: '新候选人', class: 'badge-new' },
  phone_screen: { text: '电话筛选中', class: 'badge-phone_screen' },
  interviewing: { text: '面试中', class: 'badge-interviewing' },
  offered: { text: '已发offer', class: 'badge-offered' },
  rejected: { text: '已淘汰', class: 'badge-rejected' },
  hired: { text: '已录用', class: 'badge-hired' }
};

const POS_STATUS_MAP = {
  open: { text: '招聘中', class: 'badge-open' },
  paused: { text: '暂停', class: 'badge-paused' },
  closed: { text: '已关闭', class: 'badge-closed' }
};

const INTERVIEW_TYPE_MAP = {
  phone: { text: '电话面试', class: 'badge-phone' },
  video: { text: '视频面试', class: 'badge-video' },
  onsite: { text: '现场面试', class: 'badge-onsite' },
  technical: { text: '技术面试', class: 'badge-technical' }
};

const INTERVIEW_RESULT_MAP = {
  pending: { text: '待定', class: 'badge-pending' },
  pass: { text: '通过', class: 'badge-pass' },
  fail: { text: '未通过', class: 'badge-fail' }
};

const REMINDER_TYPE_MAP = {
  follow_up: '跟进',
  interview: '面试',
  offer: 'Offer',
  deadline: '截止日期'
};

let currentSkills = [];
let currentRating = 0;
let currentCandidateId = null;
let filterState = {
  candidateSearch: '',
  candidatePosition: '',
  candidateStatus: ''
};
let pendingScrapeData = null;

const REPEAT_INTERVAL_MAP = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function isOverdue(dateStr) {
  return dateStr && new Date(dateStr) < new Date();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function init() {
  bindTabSwitch();
  bindActions();
  bindSearchAndFilter();
  bindSkillInput();
  bindStarRating();
  bindDynamicRows();
  bindMessageListener();
  loadAll();
  startReminderCheck();
  checkPendingScrapeData();
}

function bindMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_CANDIDATE_WITH_SCRAPE') {
      pendingScrapeData = message.data;
      setTimeout(() => {
        const tab = document.querySelector('[data-tab="candidates"]');
        if (tab) tab.click();
        openCandidateModal(null, message.data);
      }, 200);
      sendResponse({ status: 'ok' });
    }
    return true;
  });
}

function startReminderCheck() {
  updatePendingReminderBadge();
  setInterval(updatePendingReminderBadge, 60000);
}

async function updatePendingReminderBadge() {
  const pending = await getPendingReminders();
  const badge = document.querySelector('[data-hook="pending-reminder-badge"]');
  const countText = document.querySelector('[data-hook="pending-count-text"]');
  const count = pending.length;
  if (badge) {
    if (count > 0) {
      badge.hidden = false;
      badge.textContent = count > 99 ? '99+' : count;
    } else {
      badge.hidden = true;
    }
  }
  if (countText) {
    countText.textContent = count > 0 ? `(${count} 条待处理)` : '';
  }
}

function checkPendingScrapeData() {
  if (pendingScrapeData) {
    const tab = document.querySelector('[data-tab="candidates"]');
    if (tab) tab.click();
    openCandidateModal(null, pendingScrapeData);
    pendingScrapeData = null;
  }
}

function bindTabSwitch() {
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.tab-pane').forEach(p => p.classList.remove('active'));
      const pane = $(`[data-pane="${btn.dataset.tab}"]`);
      if (pane) pane.classList.add('active');
    });
  });
}

function bindActions() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    switch (action) {
      case 'switch-tab': break;
      case 'add-position': openPositionModal(); break;
      case 'save-position': savePosition(); break;
      case 'edit-position': openPositionModal(btn.dataset.id); break;
      case 'delete-position': handleDeletePosition(btn.dataset.id); break;
      case 'add-candidate': openCandidateModal(); break;
      case 'save-candidate': saveCandidate(); break;
      case 'edit-candidate': openCandidateModal(btn.dataset.id); break;
      case 'delete-candidate': handleDeleteCandidate(btn.dataset.id); break;
      case 'scrape-page': scrapePage(); break;
      case 'view-candidate-detail': openCandidateDetail(btn.dataset.id); break;
      case 'back-to-candidates': backToCandidateList(); break;
      case 'edit-candidate-detail': openCandidateModal(currentCandidateId); break;
      case 'delete-candidate-detail': handleDeleteCandidate(currentCandidateId); break;
      case 'add-interview': openInterviewModal(); break;
      case 'save-interview': saveInterview(); break;
      case 'edit-interview': openInterviewModal(btn.dataset.id); break;
      case 'delete-interview': handleDeleteInterview(btn.dataset.id); break;
      case 'add-reminder': openReminderModal(); break;
      case 'save-reminder': saveReminder(); break;
      case 'complete-reminder': completeReminder(btn.dataset.id); break;
      case 'snooze-reminder': handleSnoozeReminder(btn.dataset.id, parseInt(btn.dataset.minutes)); break;
      case 'delete-reminder': handleDeleteReminder(btn.dataset.id); break;
      case 'close-modal': closeModal(btn.dataset.modal); break;
      case 'export-csv': exportCSV(); break;
      case 'add-link': addLinkRow(); break;
      case 'remove-link': btn.closest('.dynamic-row').remove(); break;
      case 'add-question': addQuestionRow(); break;
      case 'remove-question': btn.closest('.dynamic-row').remove(); break;
      case 'remove-skill-tag': removeSkillTag(btn.dataset.skill); break;
      case 'view-candidate-interviews': viewCandidateInterviews(btn.dataset.id); break;
    }
  });
}

function bindSearchAndFilter() {
  const positionSearch = $('[data-hook="position-search"]');
  if (positionSearch) {
    positionSearch.addEventListener('input', debounce(() => renderPositions(), 300));
  }

  const candidateSearch = $('[data-hook="candidate-search"]');
  if (candidateSearch) {
    candidateSearch.addEventListener('input', debounce(() => {
      filterState.candidateSearch = candidateSearch.value;
      renderCandidates();
    }, 300));
  }

  const candidatePosFilter = $('[data-hook="candidate-position-filter"]');
  if (candidatePosFilter) {
    candidatePosFilter.addEventListener('change', () => {
      filterState.candidatePosition = candidatePosFilter.value;
      renderCandidates();
    });
  }

  const candidateStatusFilter = $('[data-hook="candidate-status-filter"]');
  if (candidateStatusFilter) {
    candidateStatusFilter.addEventListener('change', () => {
      filterState.candidateStatus = candidateStatusFilter.value;
      renderCandidates();
    });
  }

  const interviewSearch = $('[data-hook="interview-search"]');
  if (interviewSearch) {
    interviewSearch.addEventListener('input', debounce(() => renderInterviews(), 300));
  }

  const interviewPosFilter = $('[data-hook="interview-position-filter"]');
  if (interviewPosFilter) {
    interviewPosFilter.addEventListener('change', () => renderInterviews());
  }
}

function restoreFilterState() {
  const candidateSearch = $('[data-hook="candidate-search"]');
  const candidatePosFilter = $('[data-hook="candidate-position-filter"]');
  const candidateStatusFilter = $('[data-hook="candidate-status-filter"]');
  if (candidateSearch) candidateSearch.value = filterState.candidateSearch;
  if (candidatePosFilter) candidatePosFilter.value = filterState.candidatePosition;
  if (candidateStatusFilter) candidateStatusFilter.value = filterState.candidateStatus;
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function bindSkillInput() {
  const input = $('[data-hook="skills-input"]');
  if (!input) return;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = input.value.trim();
      if (val && !currentSkills.includes(val)) {
        currentSkills.push(val);
        renderSkillTags();
        input.value = '';
      }
    }
  });
}

function renderSkillTags() {
  const container = $('[data-hook="skills-tags"]');
  const hidden = $('[data-hook="candidate-skills-hidden"]');
  if (!container) return;
  container.innerHTML = currentSkills.map(s =>
    `<span class="skill-tag">${escapeHtml(s)}<button type="button" class="skill-tag-remove" data-action="remove-skill-tag" data-skill="${escapeHtml(s)}">×</button></span>`
  ).join('');
  if (hidden) hidden.value = JSON.stringify(currentSkills);
}

function removeSkillTag(skill) {
  currentSkills = currentSkills.filter(s => s !== skill);
  renderSkillTags();
}

function bindStarRating() {
  const container = $('[data-hook="interview-star-rating"]');
  if (!container) return;
  container.addEventListener('click', (e) => {
    const star = e.target.closest('.star');
    if (!star) return;
    currentRating = parseInt(star.dataset.value);
    updateStarDisplay();
    const hidden = $('[data-hook="interview-rating"]');
    if (hidden) hidden.value = currentRating;
  });
  container.addEventListener('mouseover', (e) => {
    const star = e.target.closest('.star');
    if (!star) return;
    const val = parseInt(star.dataset.value);
    $$('.star', container).forEach(s => {
      s.classList.toggle('hover', parseInt(s.dataset.value) <= val);
    });
  });
  container.addEventListener('mouseleave', () => {
    $$('.star', container).forEach(s => s.classList.remove('hover'));
  });
}

function updateStarDisplay() {
  const container = $('[data-hook="interview-star-rating"]');
  if (!container) return;
  $$('.star', container).forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.value) <= currentRating);
  });
}

function bindDynamicRows() {}

function addLinkRow() {
  const container = $('[data-hook="candidate-links-container"]');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'dynamic-row';
  row.innerHTML = `<input type="url" name="links" class="input" placeholder="https://..."><button type="button" class="btn btn-icon btn-remove" data-action="remove-link">✕</button>`;
  container.appendChild(row);
}

function addQuestionRow() {
  const container = $('[data-hook="interview-questions-container"]');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'dynamic-row';
  row.innerHTML = `<input type="text" name="questions" class="input" placeholder="面试问题..."><button type="button" class="btn btn-icon btn-remove" data-action="remove-question">✕</button>`;
  container.appendChild(row);
}

function openModal(name) {
  const modal = $(`[data-modal="${name}"]`);
  if (modal) modal.hidden = false;
}

function closeModal(name) {
  const modal = $(`[data-modal="${name}"]`);
  if (modal) {
    modal.hidden = true;
    const form = $('form', modal);
    if (form) form.reset();
  }
}

async function loadAll() {
  await Promise.all([
    renderPositions(),
    renderCandidates(),
    renderInterviews(),
    renderReminders(),
    populatePositionDropdowns(),
    populateCandidateDropdowns()
  ]);
  restoreFilterState();
}

async function populatePositionDropdowns() {
  const positions = await getPositions();
  const options = positions.filter(p => p.status === 'open').map(p =>
    `<option value="${p.id}">${escapeHtml(p.title)}</option>`
  ).join('');

  const selects = [
    $('[data-hook="candidate-position-select"]'),
    $('[data-hook="candidate-position-filter"]'),
    $('[data-hook="interview-position-filter"]')
  ];

  selects.forEach(sel => {
    if (!sel) return;
    const firstOpt = sel.options[0].outerHTML;
    sel.innerHTML = firstOpt + options;
  });
}

async function populateCandidateDropdowns() {
  const candidates = await getCandidates();
  const options = candidates.map(c =>
    `<option value="${c.id}">${escapeHtml(c.name)}</option>`
  ).join('');

  const selects = [
    $('[data-hook="interview-candidate-select"]'),
    $('[data-hook="reminder-candidate-select"]')
  ];

  selects.forEach(sel => {
    if (!sel) return;
    const firstOpt = sel.options[0].outerHTML;
    sel.innerHTML = firstOpt + options;
  });
}

async function renderPositions() {
  const positions = await getPositions();
  const candidates = await getCandidates();
  const searchTerm = ($('[data-hook="position-search"]')?.value || '').toLowerCase();

  let filtered = positions;
  if (searchTerm) {
    filtered = positions.filter(p =>
      (p.title || '').toLowerCase().includes(searchTerm) ||
      (p.department || '').toLowerCase().includes(searchTerm) ||
      (p.location || '').toLowerCase().includes(searchTerm)
    );
  }

  const list = $('[data-hook="position-list"]');
  const empty = $('[data-hook="positions-empty"]');

  if (!list) return;

  if (filtered.length === 0) {
    list.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;

  list.innerHTML = filtered.map(p => {
    const candidateCount = candidates.filter(c => c.positionId === p.id).length;
    const status = POS_STATUS_MAP[p.status] || POS_STATUS_MAP.open;
    return `
      <li class="card">
        <div class="card-header">
          <div class="card-title">${escapeHtml(p.title)}</div>
          <span class="badge ${status.class}">${status.text}</span>
        </div>
        <div class="card-body">
          ${p.department ? `<span class="card-meta">🏢 ${escapeHtml(p.department)}</span>` : ''}
          ${p.location ? `<span class="card-meta">📍 ${escapeHtml(p.location)}</span>` : ''}
          <span class="card-meta">👤 ${candidateCount} 位候选人</span>
        </div>
        <div class="card-footer">
          <span class="card-date">${formatDate(p.createdAt)}</span>
          <div class="card-actions">
            <button class="btn btn-link" data-action="edit-position" data-id="${p.id}">编辑</button>
            <button class="btn btn-link btn-danger-link" data-action="delete-position" data-id="${p.id}">删除</button>
          </div>
        </div>
      </li>`;
  }).join('');
}

async function openPositionModal(id) {
  const title = $('[data-hook="position-modal-title"]');
  const idField = $('[data-hook="position-id"]');

  if (id) {
    const positions = await getPositions();
    const pos = positions.find(p => p.id === id);
    if (!pos) return;
    if (title) title.textContent = '编辑职位';
    if (idField) idField.value = pos.id;
    const form = $('[data-hook="position-form"]');
    if (form) {
      form.title.value = pos.title || '';
      form.department.value = pos.department || '';
      form.location.value = pos.location || '';
      form.status.value = pos.status || 'open';
      form.description.value = pos.description || '';
    }
  } else {
    if (title) title.textContent = '新增职位';
    if (idField) idField.value = '';
  }

  openModal('position-modal');
}

async function savePosition() {
  const form = $('[data-hook="position-form"]');
  if (!form) return;
  const titleInput = form.querySelector('[name="title"]');
  if (!titleInput.value.trim()) {
    titleInput.focus();
    return;
  }

  const id = $('[data-hook="position-id"]')?.value;
  const data = {
    title: form.title.value.trim(),
    department: form.department.value.trim(),
    location: form.location.value.trim(),
    status: form.status.value,
    description: form.description.value.trim()
  };

  if (id) {
    await updatePosition(id, data);
  } else {
    await addPosition(data);
  }

  closeModal('position-modal');
  await renderPositions();
  await populatePositionDropdowns();
}

async function handleDeletePosition(id) {
  const positions = await getPositions();
  const candidates = await getCandidates();
  const pos = positions.find(p => p.id === id);
  const affectedCount = candidates.filter(c => c.positionId === id).length;

  if (affectedCount > 0) {
    if (!confirm(`确定删除职位「${pos?.title || ''}」？\n\n该职位关联 ${affectedCount} 位候选人，删除后这些候选人将变为未关联状态，资料不会丢失。`)) return;
  } else {
    if (!confirm(`确定删除职位「${pos?.title || ''}」？`)) return;
  }

  await deletePosition(id);
  await renderPositions();
  await populatePositionDropdowns();
  await renderCandidates();
}

async function renderCandidates() {
  const candidates = await getCandidates();
  const positions = await getPositions();
  const searchTerm = filterState.candidateSearch.toLowerCase();
  const posFilter = filterState.candidatePosition;
  const statusFilter = filterState.candidateStatus;

  let filtered = candidates;
  if (searchTerm) {
    filtered = filtered.filter(c =>
      (c.name || '').toLowerCase().includes(searchTerm) ||
      (c.currentCompany || '').toLowerCase().includes(searchTerm) ||
      (c.email || '').toLowerCase().includes(searchTerm) ||
      (c.skills || []).some(s => s.toLowerCase().includes(searchTerm))
    );
  }
  if (posFilter) {
    filtered = filtered.filter(c => c.positionId === posFilter);
  }
  if (statusFilter) {
    filtered = filtered.filter(c => c.status === statusFilter);
  }

  const list = $('[data-hook="candidate-list"]');
  const empty = $('[data-hook="candidates-empty"]');

  if (!list) return;

  if (filtered.length === 0) {
    list.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;

  list.innerHTML = filtered.map(c => {
    const pos = positions.find(p => p.id === c.positionId);
    const status = STATUS_MAP[c.status] || STATUS_MAP.new;
    const skillsHtml = (c.skills || []).slice(0, 4).map(s =>
      `<span class="skill-tag small">${escapeHtml(s)}</span>`
    ).join('') + ((c.skills || []).length > 4 ? `<span class="skill-tag small">+${c.skills.length - 4}</span>` : '');

    return `
      <li class="card">
        <div class="card-header">
          <div class="card-title">${escapeHtml(c.name)}</div>
          <span class="badge ${status.class}">${status.text}</span>
        </div>
        <div class="card-body">
          ${c.currentCompany ? `<span class="card-meta">🏢 ${escapeHtml(c.currentCompany)}</span>` : ''}
          ${pos ? `<span class="card-meta">📋 ${escapeHtml(pos.title)}</span>` : ''}
          ${c.expectedSalary ? `<span class="card-meta">💰 ${escapeHtml(c.expectedSalary)}</span>` : ''}
          ${c.source ? `<span class="card-meta">🔗 ${escapeHtml(c.source)}</span>` : ''}
        </div>
        ${skillsHtml ? `<div class="card-skills">${skillsHtml}</div>` : ''}
        ${c.phoneScreenResult ? `<div class="card-snippet">📞 ${escapeHtml(c.phoneScreenResult.substring(0, 60))}${c.phoneScreenResult.length > 60 ? '...' : ''}</div>` : ''}
        <div class="card-footer">
          <span class="card-date">${formatDate(c.createdAt)}</span>
          <div class="card-actions">
            <button class="btn btn-link" data-action="view-candidate-detail" data-id="${c.id}">查看详情</button>
            <button class="btn btn-link" data-action="edit-candidate" data-id="${c.id}">编辑</button>
            <button class="btn btn-link btn-danger-link" data-action="delete-candidate" data-id="${c.id}">删除</button>
          </div>
        </div>
      </li>`;
  }).join('');
}

async function openCandidateModal(id, scrapeData) {
  const title = $('[data-hook="candidate-modal-title"]');
  const idField = $('[data-hook="candidate-id"]');
  currentSkills = [];

  const container = $('[data-hook="candidate-links-container"]');
  if (container) {
    container.innerHTML = `<div class="dynamic-row"><input type="url" name="links" class="input" placeholder="https://..."><button type="button" class="btn btn-icon btn-remove" data-action="remove-link">✕</button></div>`;
  }

  await populatePositionDropdowns();

  if (id) {
    const candidates = await getCandidates();
    const cand = candidates.find(c => c.id === id);
    if (!cand) return;
    if (title) title.textContent = '编辑候选人';
    if (idField) idField.value = cand.id;
    const form = $('[data-hook="candidate-form"]');
    if (form) {
      form.name.value = cand.name || '';
      form.phone.value = cand.phone || '';
      form.wechat.value = cand.wechat || '';
      form.email.value = cand.email || '';
      form.currentCompany.value = cand.currentCompany || '';
      form.expectedSalary.value = cand.expectedSalary || '';
      form.source.value = cand.source || '';
      form.positionId.value = cand.positionId || '';
      form.status.value = cand.status || 'new';
      form.phoneScreenResult.value = cand.phoneScreenResult || '';
      form.advanceReason.value = cand.advanceReason || '';
      form.rejectReason.value = cand.rejectReason || '';
      form.notes.value = cand.notes || '';
    }

    currentSkills = cand.skills || [];
    renderSkillTags();

    if (cand.links && cand.links.length > 0) {
      container.innerHTML = '';
      cand.links.forEach(link => {
        const url = typeof link === 'string' ? link : link.url;
        const row = document.createElement('div');
        row.className = 'dynamic-row';
        row.innerHTML = `<input type="url" name="links" class="input" placeholder="https://..." value="${escapeHtml(url)}"><button type="button" class="btn btn-icon btn-remove" data-action="remove-link">✕</button>`;
        container.appendChild(row);
      });
    }
  } else {
    if (title) title.textContent = '新增候选人';
    if (idField) idField.value = '';

    if (scrapeData) {
      const form = $('[data-hook="candidate-form"]');
      if (form) {
        form.name.value = scrapeData.name || '';
        form.phone.value = scrapeData.phone || '';
        form.wechat.value = scrapeData.wechat || '';
        form.email.value = scrapeData.email || '';
        form.currentCompany.value = scrapeData.currentCompany || '';
        if (scrapeData.source) {
          form.source.value = scrapeData.source;
        }
      }
      if (scrapeData.links && scrapeData.links.length > 0) {
        container.innerHTML = '';
        scrapeData.links.forEach(link => {
          const url = typeof link === 'string' ? link : link.url;
          const row = document.createElement('div');
          row.className = 'dynamic-row';
          row.innerHTML = `<input type="url" name="links" class="input" placeholder="https://..." value="${escapeHtml(url)}"><button type="button" class="btn btn-icon btn-remove" data-action="remove-link">✕</button>`;
          container.appendChild(row);
        });
      }
    }
  }

  openModal('candidate-modal');
}

async function saveCandidate() {
  const form = $('[data-hook="candidate-form"]');
  if (!form) return;
  const nameInput = form.querySelector('[name="name"]');
  if (!nameInput.value.trim()) {
    nameInput.focus();
    return;
  }

  const id = $('[data-hook="candidate-id"]')?.value;
  const linkInputs = $$('input[name="links"]', form);
  const links = linkInputs.map(i => i.value.trim()).filter(v => v);

  const data = {
    name: form.name.value.trim(),
    phone: form.phone.value.trim(),
    email: form.email.value.trim(),
    wechat: form.wechat?.value?.trim() || '',
    currentCompany: form.currentCompany.value.trim(),
    expectedSalary: form.expectedSalary.value.trim(),
    source: form.source.value,
    positionId: form.positionId.value,
    status: form.status.value,
    phoneScreenResult: form.phoneScreenResult.value.trim(),
    advanceReason: form.advanceReason.value.trim(),
    rejectReason: form.rejectReason.value.trim(),
    notes: form.notes.value.trim(),
    skills: [...currentSkills],
    links: links
  };

  if (form.status.value === 'rejected' && form.rejectReason.value.trim()) {
    data.statusChangeReason = '淘汰：' + form.rejectReason.value.trim();
  } else if (form.status.value === 'advanced' && form.advanceReason.value.trim()) {
    data.statusChangeReason = '推进：' + form.advanceReason.value.trim();
  }

  let savedCandidate = null;
  if (id) {
    await updateCandidate(id, data);
    savedCandidate = { id, ...data };
  } else {
    savedCandidate = await addCandidate(data);
    if (!data.pageUrl) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          await updateCandidate(savedCandidate.id, { pageUrl: tab.url });
          savedCandidate.pageUrl = tab.url;
        }
      } catch (e) {}
    }
  }

  closeModal('candidate-modal');
  currentSkills = [];
  
  if (savedCandidate && savedCandidate.pageUrl) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && tab.url === savedCandidate.pageUrl) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'CANDIDATE_SAVED',
          candidate: savedCandidate
        });
      }
    } catch (e) {}
  }

  if (currentCandidateId) {
    await renderCandidateDetail(currentCandidateId);
  } else {
    restoreFilterState();
    await renderCandidates();
  }
  
  await populateCandidateDropdowns();
  await renderPositions();
}

async function handleDeleteCandidate(id) {
  if (!confirm('确定删除此候选人？关联的面试记录和提醒也将被删除。')) return;
  await deleteCandidate(id);
  
  if (currentCandidateId && currentCandidateId === id) {
    currentCandidateId = null;
    document.querySelectorAll('[data-pane]').forEach(p => p.hidden = true);
    const candidatesPane = document.querySelector('[data-pane="candidates"]');
    if (candidatesPane) candidatesPane.hidden = false;
  }
  
  restoreFilterState();
  await renderCandidates();
  await populateCandidateDropdowns();
  await renderInterviews();
  await renderReminders();
  await renderPositions();
}

async function scrapePage() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'SCRAPE_PAGE' });
    if (response && response.name) {
      await openCandidateModal(null, response);
    } else {
      await openCandidateModal(null, response || {});
      alert('未能自动抓取到完整信息，请手动填写。抓取到的数据已填入可用字段。');
    }
  } catch (e) {
    console.error('Scrape failed:', e);
    alert('抓取失败，请手动添加候选人。');
  }
}

function viewCandidateInterviews(candidateId) {
  const tab = document.querySelector('[data-tab="interviews"]');
  if (tab) tab.click();
  setTimeout(() => {
    const searchInput = $('[data-hook="interview-search"]');
    if (searchInput) {
      const candidates = window._candidatesCache || [];
      const cand = candidates.find(c => c.id === candidateId);
      if (cand) {
        searchInput.value = cand.name;
        searchInput.dispatchEvent(new Event('input'));
      }
    }
  }, 100);
}

async function renderInterviews() {
  const interviews = await getInterviews();
  const candidates = await getCandidates();
  const positions = await getPositions();
  window._candidatesCache = candidates;

  const searchTerm = ($('[data-hook="interview-search"]')?.value || '').toLowerCase();
  const posFilter = $('[data-hook="interview-position-filter"]')?.value || '';

  let filtered = interviews;
  if (searchTerm) {
    filtered = filtered.filter(i => {
      const cand = candidates.find(c => c.id === i.candidateId);
      return (cand?.name || '').toLowerCase().includes(searchTerm) ||
             (i.interviewer || '').toLowerCase().includes(searchTerm);
    });
  }
  if (posFilter) {
    filtered = filtered.filter(i => {
      const cand = candidates.find(c => c.id === i.candidateId);
      return cand?.positionId === posFilter;
    });
  }

  const list = $('[data-hook="interview-list"]');
  const empty = $('[data-hook="interviews-empty"]');

  if (!list) return;

  if (filtered.length === 0) {
    list.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;

  list.innerHTML = filtered.map(i => {
    const cand = candidates.find(c => c.id === i.candidateId);
    const pos = cand ? positions.find(p => p.id === cand.positionId) : null;
    const type = INTERVIEW_TYPE_MAP[i.type] || INTERVIEW_TYPE_MAP.phone;
    const result = INTERVIEW_RESULT_MAP[i.result] || INTERVIEW_RESULT_MAP.pending;
    const stars = '★'.repeat(i.rating || 0) + '☆'.repeat(5 - (i.rating || 0));

    return `
      <li class="card">
        <div class="card-header">
          <div class="card-title">${escapeHtml(cand?.name || '未知候选人')} - 第${i.round}轮</div>
          <span class="badge ${type.class}">${type.text}</span>
        </div>
        <div class="card-body">
          ${pos ? `<span class="card-meta">📋 ${escapeHtml(pos.title)}</span>` : ''}
          ${i.date ? `<span class="card-meta">📅 ${formatDateTime(i.date)}</span>` : ''}
          ${i.interviewer ? `<span class="card-meta">👤 ${escapeHtml(i.interviewer)}</span>` : ''}
        </div>
        ${i.rating ? `<div class="card-rating">${stars}</div>` : ''}
        ${i.evaluation ? `<div class="card-snippet">${escapeHtml(i.evaluation.substring(0, 80))}${i.evaluation.length > 80 ? '...' : ''}</div>` : ''}
        <div class="card-footer">
          <span class="badge ${result.class}">${result.text}</span>
          <div class="card-actions">
            <button class="btn btn-link" data-action="edit-interview" data-id="${i.id}">编辑</button>
            <button class="btn btn-link btn-danger-link" data-action="delete-interview" data-id="${i.id}">删除</button>
          </div>
        </div>
      </li>`;
  }).join('');
}

async function openInterviewModal(id) {
  const title = $('[data-hook="interview-modal-title"]');
  const idField = $('[data-hook="interview-id"]');
  currentRating = 0;

  const container = $('[data-hook="interview-questions-container"]');
  if (container) {
    container.innerHTML = `<div class="dynamic-row"><input type="text" name="questions" class="input" placeholder="面试问题..."><button type="button" class="btn btn-icon btn-remove" data-action="remove-question">✕</button></div>`;
  }

  await populateCandidateDropdowns();

  if (id) {
    const interviews = await getInterviews();
    const iv = interviews.find(i => i.id === id);
    if (!iv) return;
    if (title) title.textContent = '编辑面试';
    if (idField) idField.value = iv.id;
    const form = $('[data-hook="interview-form"]');
    if (form) {
      form.candidateId.value = iv.candidateId || '';
      form.round.value = iv.round || 1;
      form.type.value = iv.type || 'phone';
      form.date.value = iv.date || '';
      form.interviewer.value = iv.interviewer || '';
      form.evaluation.value = iv.evaluation || '';
      form.result.value = iv.result || 'pending';
    }
    currentRating = iv.rating || 0;
    updateStarDisplay();
    const ratingHidden = $('[data-hook="interview-rating"]');
    if (ratingHidden) ratingHidden.value = currentRating;

    if (iv.questions && iv.questions.length > 0) {
      container.innerHTML = '';
      iv.questions.forEach(q => {
        const row = document.createElement('div');
        row.className = 'dynamic-row';
        row.innerHTML = `<input type="text" name="questions" class="input" placeholder="面试问题..." value="${escapeHtml(q)}"><button type="button" class="btn btn-icon btn-remove" data-action="remove-question">✕</button>`;
        container.appendChild(row);
      });
    }
  } else {
    if (title) title.textContent = '新增面试';
    if (idField) idField.value = '';
  }

  openModal('interview-modal');
}

async function saveInterview() {
  const form = $('[data-hook="interview-form"]');
  if (!form) return;
  const candidateInput = form.querySelector('[name="candidateId"]');
  const dateInput = form.querySelector('[name="date"]');
  if (!candidateInput.value) {
    candidateInput.focus();
    return;
  }
  if (!dateInput.value) {
    dateInput.focus();
    return;
  }

  const id = $('[data-hook="interview-id"]')?.value;
  const questionInputs = $$('input[name="questions"]', form);
  const questions = questionInputs.map(i => i.value.trim()).filter(v => v);

  const data = {
    candidateId: form.candidateId.value,
    round: parseInt(form.round.value) || 1,
    type: form.type.value,
    date: form.date.value,
    interviewer: form.interviewer.value.trim(),
    evaluation: form.evaluation.value.trim(),
    rating: currentRating,
    result: form.result.value,
    questions: questions
  };

  if (id) {
    await updateInterview(id, data);
  } else {
    await addInterview(data);
  }

  closeModal('interview-modal');
  currentRating = 0;
  await renderInterviews();
}

async function handleDeleteInterview(id) {
  if (!confirm('确定删除此面试记录？')) return;
  await deleteInterview(id);
  await renderInterviews();
}

async function renderReminders() {
  const reminders = await getReminders();
  const candidates = await getCandidates();

  const sorted = [...reminders].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(a.scheduledTime) - new Date(b.scheduledTime);
  });

  const list = $('[data-hook="reminder-list"]');
  const empty = $('[data-hook="reminders-empty"]');

  if (!list) return;

  if (sorted.length === 0) {
    list.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;

  list.innerHTML = sorted.map(r => {
    const cand = candidates.find(c => c.id === r.candidateId);
    const overdue = !r.completed && isOverdue(r.scheduledTime);
    const typeText = REMINDER_TYPE_MAP[r.type] || r.type;

    const snoozeButtons = !r.completed ? `
      <div class="snooze-buttons">
        <button class="snooze-btn" data-action="snooze-reminder" data-id="${r.id}" data-minutes="5" title="5分钟后">5m</button>
        <button class="snooze-btn" data-action="snooze-reminder" data-id="${r.id}" data-minutes="15" title="15分钟后">15m</button>
        <button class="snooze-btn" data-action="snooze-reminder" data-id="${r.id}" data-minutes="30" title="30分钟后">30m</button>
        <button class="snooze-btn" data-action="snooze-reminder" data-id="${r.id}" data-minutes="60" title="1小时后">1h</button>
      </div>` : '';

    return `
      <li class="card ${overdue ? 'card-overdue' : ''} ${r.completed ? 'card-completed' : ''}">
        <div class="card-header">
          <div class="card-title">${escapeHtml(cand?.name || r.candidateName || '未知候选人')}</div>
          <span class="badge ${overdue ? 'badge-rejected' : 'badge-new'}">${typeText}</span>
        </div>
        <div class="card-body">
          <span class="card-meta ${overdue ? 'text-danger' : ''}">📅 ${formatDateTime(r.scheduledTime)}${overdue ? ' (已过期)' : ''}</span>
        </div>
        ${r.note ? `<div class="card-snippet">${escapeHtml(r.note.substring(0, 80))}</div>` : ''}
        ${snoozeButtons}
        <div class="card-footer">
          <span class="card-date">${formatDate(r.createdAt)}</span>
          <div class="card-actions">
            ${!r.completed ? `<button class="btn btn-link" data-action="complete-reminder" data-id="${r.id}">完成</button>` : '<span class="text-muted">已完成</span>'}
            <button class="btn btn-link btn-danger-link" data-action="delete-reminder" data-id="${r.id}">删除</button>
          </div>
        </div>
      </li>`;
  }).join('');
}

async function openReminderModal() {
  const title = $('[data-hook="reminder-modal-title"]');
  const idField = $('[data-hook="reminder-id"]');
  if (title) title.textContent = '新增提醒';
  if (idField) idField.value = '';

  await populateCandidateDropdowns();
  openModal('reminder-modal');
}

async function saveReminder() {
  const form = $('[data-hook="reminder-form"]');
  if (!form) return;
  const candidateInput = form.querySelector('[name="candidateId"]');
  const timeInput = form.querySelector('[name="scheduledTime"]');
  if (!candidateInput.value) {
    candidateInput.focus();
    return;
  }
  if (!timeInput.value) {
    timeInput.focus();
    return;
  }

  const candidates = await getCandidates();
  const cand = candidates.find(c => c.id === form.candidateId.value);

  const data = {
    candidateId: form.candidateId.value,
    candidateName: cand?.name || '',
    type: form.type.value,
    scheduledTime: form.scheduledTime.value,
    note: form.note.value.trim(),
    earlyReminder: form.earlyReminder?.value || '0',
    repeatInterval: form.repeatInterval?.value || 'none',
    originalScheduledTime: form.scheduledTime.value
  };

  await addReminder(data);

  try {
    const scheduledDate = new Date(form.scheduledTime.value);
    const earlyMinutes = parseInt(form.earlyReminder?.value || '0');
    if (earlyMinutes > 0) {
      const earlyDate = new Date(scheduledDate.getTime() - earlyMinutes * 60000);
      const now = new Date();
      const delay = earlyDate.getTime() - now.getTime();
      if (delay > 0 && delay < 14400000) {
        chrome.alarms.create('checkReminders', { delayInMinutes: Math.max(delay / 60000, 0.1) });
      }
    }
    const delay = scheduledDate.getTime() - new Date().getTime();
    if (delay > 0 && delay < 14400000) {
      chrome.alarms.create('checkReminders', { delayInMinutes: Math.max(delay / 60000, 0.1) });
    }
  } catch (e) {}

  closeModal('reminder-modal');
  updatePendingReminderBadge();
  if (currentCandidateId) {
    renderCandidateDetail(currentCandidateId);
  } else {
    renderReminders();
  }
}

async function handleSnoozeReminder(id, minutes) {
  await snoozeReminder(id, minutes);
  updatePendingReminderBadge();
  if (currentCandidateId) {
    renderCandidateDetail(currentCandidateId);
  } else {
    renderReminders();
  }
}

async function completeReminder(id) {
  await updateReminder(id, { completed: true });
  updatePendingReminderBadge();
  if (currentCandidateId) {
    renderCandidateDetail(currentCandidateId);
  } else {
    renderReminders();
  }
}

async function handleDeleteReminder(id) {
  if (!confirm('确定删除此提醒？')) return;
  await deleteReminder(id);
  updatePendingReminderBadge();
  if (currentCandidateId) {
    renderCandidateDetail(currentCandidateId);
  } else {
    renderReminders();
  }
}

async function exportCSV() {
  const candidates = await getCandidates();
  const positions = await getPositions();
  
  let filteredCandidates = candidates;
  if (filterState.candidatePosition) {
    filteredCandidates = candidates.filter(c => c.positionId === filterState.candidatePosition);
  }

  if (positions.length > 1 && !filterState.candidatePosition) {
    const choice = prompt(`导出哪个职位的候选人？\n留空导出全部\n\n${positions.map((p, i) => `${i + 1}. ${p.title}`).join('\n')}\n\n请输入序号：`);
    if (choice !== null && choice !== '') {
      const idx = parseInt(choice) - 1;
      if (idx >= 0 && idx < positions.length) {
        filteredCandidates = candidates.filter(c => c.positionId === positions[idx].id);
      }
    }
  }

  const csv = await exportCandidatesCSV('', filteredCandidates);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `候选人列表_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function openCandidateDetail(candidateId) {
  currentCandidateId = candidateId;
  await renderCandidateDetail(candidateId);
  
  document.querySelectorAll('[data-pane]').forEach(p => p.hidden = true);
  const detailPane = document.querySelector('[data-pane="candidate-detail"]');
  if (detailPane) detailPane.hidden = false;
}

async function backToCandidateList() {
  currentCandidateId = null;
  document.querySelectorAll('[data-pane]').forEach(p => p.hidden = true);
  const candidatesPane = document.querySelector('[data-pane="candidates"]');
  if (candidatesPane) candidatesPane.hidden = false;
  
  restoreFilterState();
  await renderCandidates();
}

async function renderCandidateDetail(candidateId) {
  const candidates = await getCandidates();
  const positions = await getPositions();
  const interviews = await getInterviews();
  const reminders = await getReminders();
  
  const candidate = candidates.find(c => c.id === candidateId);
  if (!candidate) return;
  
  const pos = positions.find(p => p.id === candidate.positionId);
  const status = STATUS_MAP[candidate.status] || STATUS_MAP.new;
  
  const candidateInterviews = interviews
    .filter(i => i.candidateId === candidateId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const candidateReminders = reminders
    .filter(r => r.candidateId === candidateId)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(a.scheduledTime) - new Date(b.scheduledTime);
    });
  
  const pendingReminders = candidateReminders.filter(r => !r.completed);
  const completedReminders = candidateReminders.filter(r => r.completed);
  
  const skillsHtml = (candidate.skills || []).map(s =>
    `<span class="skill-tag">${escapeHtml(s)}</span>`
  ).join('');
  
  const linksHtml = (candidate.links || []).map((link, idx) => {
    if (!link) return '';
    const parts = link.split('|');
    const label = parts[0] || '链接';
    const url = parts[1] || link;
    return `<div class="detail-info-item">
      <span class="detail-info-label">🔗 ${escapeHtml(label)}</span>
      <a href="${escapeHtml(url)}" target="_blank" class="detail-info-value link">${escapeHtml(url)}</a>
    </div>`;
  }).join('');
  
  const interviewsHtml = candidateInterviews.length > 0 ? candidateInterviews.map(iv => {
    const type = INTERVIEW_TYPE_MAP[iv.type] || INTERVIEW_TYPE_MAP.phone;
    const result = INTERVIEW_RESULT_MAP[iv.result] || INTERVIEW_RESULT_MAP.pending;
    const stars = '★'.repeat(iv.rating || 0) + '☆'.repeat(5 - (iv.rating || 0));
    const questionsHtml = (iv.questions || []).map(q => `<span class="skill-tag small">${escapeHtml(q)}</span>`).join('');
    
    return `<div class="detail-history-item">
      <div class="detail-history-header">
        <span class="badge ${type.class}">${type.text} · 第${iv.round}轮</span>
        <span class="badge ${result.class}">${result.text}</span>
        <span class="detail-history-date">${formatDateTime(iv.date)}</span>
      </div>
      ${iv.rating ? `<div class="card-rating">${stars}</div>` : ''}
      ${iv.interviewer ? `<div class="detail-info-item"><span class="detail-info-label">面试官</span><span class="detail-info-value">${escapeHtml(iv.interviewer)}</span></div>` : ''}
      ${questionsHtml ? `<div class="detail-skill-list">${questionsHtml}</div>` : ''}
      ${iv.evaluation ? `<div class="detail-note">${escapeHtml(iv.evaluation)}</div>` : ''}
    </div>`;
  }).join('') : '<div class="detail-note">暂无面试记录</div>';
  
  const pendingRemindersHtml = pendingReminders.length > 0 ? pendingReminders.map(r => {
    const overdue = isOverdue(r.scheduledTime);
    const typeText = REMINDER_TYPE_MAP[r.type] || r.type;
    const snoozeButtons = `
      <div class="snooze-buttons">
        <button class="snooze-btn" data-action="snooze-reminder" data-id="${r.id}" data-minutes="5">5m</button>
        <button class="snooze-btn" data-action="snooze-reminder" data-id="${r.id}" data-minutes="15">15m</button>
        <button class="snooze-btn" data-action="snooze-reminder" data-id="${r.id}" data-minutes="30">30m</button>
        <button class="snooze-btn" data-action="snooze-reminder" data-id="${r.id}" data-minutes="60">1h</button>
      </div>`;
    
    return `<div class="detail-history-item ${overdue ? 'card-overdue' : ''}">
      <div class="detail-history-header">
        <span class="badge ${overdue ? 'badge-rejected' : 'badge-new'}">${typeText}</span>
        <span class="detail-history-date ${overdue ? 'text-danger' : ''}">${formatDateTime(r.scheduledTime)}${overdue ? ' (已过期)' : ''}</span>
      </div>
      ${r.note ? `<div class="detail-note">${escapeHtml(r.note)}</div>` : ''}
      ${snoozeButtons}
      <div class="card-actions">
        <button class="btn btn-link" data-action="complete-reminder" data-id="${r.id}">完成</button>
        <button class="btn btn-link btn-danger-link" data-action="delete-reminder" data-id="${r.id}">删除</button>
      </div>
    </div>`;
  }).join('') : '<div class="detail-note">暂无待处理提醒</div>';
  
  const completedRemindersHtml = completedReminders.length > 0 ? completedReminders.map(r => {
    const typeText = REMINDER_TYPE_MAP[r.type] || r.type;
    return `<div class="detail-history-item card-completed">
      <div class="detail-history-header">
        <span class="badge badge-info">${typeText}</span>
        <span class="detail-history-date">${formatDateTime(r.scheduledTime)}</span>
        <span class="text-muted">已完成</span>
      </div>
      ${r.note ? `<div class="detail-note">${escapeHtml(r.note)}</div>` : ''}
    </div>`;
  }).join('') : '';
  
  const history = [];
  if (candidate.createdAt) {
    history.push({
      time: candidate.createdAt,
      type: '创建',
      text: `创建候选人档案${candidate.source ? `，来源：${candidate.source}` : ''}`
    });
  }
  if (candidate.statusChangeReason && candidate.status) {
    history.push({
      time: candidate.updatedAt || candidate.createdAt,
      type: candidate.status === 'rejected' ? '淘汰' : '推进',
      text: candidate.statusChangeReason
    });
  }
  candidateInterviews.forEach(iv => {
    const result = INTERVIEW_RESULT_MAP[iv.result]?.text || '';
    history.push({
      time: iv.date,
      type: '面试',
      text: `第${iv.round}轮${INTERVIEW_TYPE_MAP[iv.type]?.text || '面试'} · ${result}`
    });
  });
  history.sort((a, b) => new Date(b.time) - new Date(a.time));
  
  const historyHtml = history.length > 0 ? history.map(h => `
    <div class="detail-history-item">
      <div class="detail-history-header">
        <span class="badge ${h.type === '淘汰' ? 'badge-rejected' : h.type === '面试' ? 'badge-interview' : h.type === '推进' ? 'badge-advanced' : 'badge-info'}">${h.type}</span>
        <span class="detail-history-date">${formatDateTime(h.time)}</span>
      </div>
      <div class="detail-note">${escapeHtml(h.text)}</div>
    </div>
  `).join('') : '<div class="detail-note">暂无历史记录</div>';
  
  const nameEl = document.querySelector('[data-hook="detail-name"]');
  const statusEl = document.querySelector('[data-hook="detail-status"]');
  const positionEl = document.querySelector('[data-hook="detail-position"]');
  const companyEl = document.querySelector('[data-hook="detail-company"]');
  const contactInfoEl = document.querySelector('[data-hook="detail-contact-info"]');
  const skillsEl = document.querySelector('[data-hook="detail-skills"]');
  const salaryEl = document.querySelector('[data-hook="detail-salary"]');
  const sourceEl = document.querySelector('[data-hook="detail-source"]');
  const linksEl = document.querySelector('[data-hook="detail-links"]');
  const phoneScreenEl = document.querySelector('[data-hook="detail-phone-screen"]');
  const interviewsSectionEl = document.querySelector('[data-hook="detail-interviews"]');
  const pendingRemindersEl = document.querySelector('[data-hook="detail-pending-reminders"]');
  const completedRemindersEl = document.querySelector('[data-hook="detail-completed-reminders"]');
  const historyEl = document.querySelector('[data-hook="detail-history"]');
  
  if (nameEl) nameEl.textContent = candidate.name || '';
  if (statusEl) { statusEl.textContent = status.text; statusEl.className = `badge ${status.class}`; }
  if (positionEl) positionEl.textContent = pos ? pos.title : '未关联职位';
  if (companyEl) companyEl.textContent = candidate.currentCompany || '';
  if (salaryEl) salaryEl.textContent = candidate.expectedSalary || '-';
  if (sourceEl) sourceEl.textContent = candidate.source || '-';
  if (skillsEl) skillsEl.innerHTML = skillsHtml || '<span class="text-muted">暂无技能标签</span>';
  if (linksEl) linksEl.innerHTML = linksHtml || '<div class="detail-info-item"><span class="detail-info-label">🔗 链接</span><span class="detail-info-value text-muted">暂无链接</span></div>';
  if (phoneScreenEl) phoneScreenEl.textContent = candidate.phoneScreenResult || '暂无电话筛选记录';
  
  let contactHtml = '';
  if (candidate.email) {
    contactHtml += `<div class="detail-info-item"><span class="detail-info-label">📧 邮箱</span><a href="mailto:${escapeHtml(candidate.email)}" class="detail-info-value link">${escapeHtml(candidate.email)}</a></div>`;
  }
  if (candidate.phone) {
    contactHtml += `<div class="detail-info-item"><span class="detail-info-label">📱 电话</span><span class="detail-info-value">${escapeHtml(candidate.phone)}</span></div>`;
  }
  if (candidate.wechat) {
    contactHtml += `<div class="detail-info-item"><span class="detail-info-label">💬 微信</span><span class="detail-info-value">${escapeHtml(candidate.wechat)}</span></div>`;
  }
  if (!contactHtml) {
    contactHtml = '<div class="detail-info-item"><span class="detail-info-label">ℹ️</span><span class="detail-info-value text-muted">暂无联系方式</span></div>';
  }
  if (contactInfoEl) contactInfoEl.innerHTML = contactHtml;
  
  if (interviewsSectionEl) interviewsSectionEl.innerHTML = interviewsHtml;
  if (pendingRemindersEl) pendingRemindersEl.innerHTML = pendingRemindersHtml;
  if (completedRemindersEl) completedRemindersEl.innerHTML = completedRemindersHtml || '<div class="detail-note text-muted">暂无已完成提醒</div>';
  if (historyEl) historyEl.innerHTML = historyHtml;
}

document.addEventListener('DOMContentLoaded', init);
