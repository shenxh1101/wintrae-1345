const STORAGE_KEYS = {
  POSITIONS: 'ra_positions',
  CANDIDATES: 'ra_candidates',
  INTERVIEWS: 'ra_interviews',
  REMINDERS: 'ra_reminders',
  SETTINGS: 'ra_settings'
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

async function getData(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] || []);
    });
  });
}

async function setData(key, data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: data }, resolve);
  });
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (result) => {
      resolve(result[STORAGE_KEYS.SETTINGS] || { defaultView: 'positions', exportFormat: 'csv' });
    });
  });
}

async function saveSettings(settings) {
  return setData(STORAGE_KEYS.SETTINGS, settings);
}

async function getPositions() {
  return getData(STORAGE_KEYS.POSITIONS);
}

async function savePositions(positions) {
  return setData(STORAGE_KEYS.POSITIONS, positions);
}

async function addPosition(position) {
  const positions = await getPositions();
  const newPosition = {
    id: generateId(),
    title: position.title || '',
    department: position.department || '',
    location: position.location || '',
    status: position.status || 'open',
    description: position.description || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  positions.push(newPosition);
  await savePositions(positions);
  return newPosition;
}

async function updatePosition(id, updates) {
  const positions = await getPositions();
  const index = positions.findIndex(p => p.id === id);
  if (index === -1) return null;
  positions[index] = { ...positions[index], ...updates, updatedAt: new Date().toISOString() };
  await savePositions(positions);
  return positions[index];
}

async function deletePosition(id) {
  let positions = await getPositions();
  positions = positions.filter(p => p.id !== id);
  await savePositions(positions);
  let candidates = await getCandidates();
  candidates = candidates.filter(c => c.positionId !== id);
  await saveCandidates(candidates);
  return true;
}

async function getCandidates() {
  return getData(STORAGE_KEYS.CANDIDATES);
}

async function saveCandidates(candidates) {
  return setData(STORAGE_KEYS.CANDIDATES, candidates);
}

async function addCandidate(candidate) {
  const candidates = await getCandidates();
  const newCandidate = {
    id: generateId(),
    name: candidate.name || '',
    email: candidate.email || '',
    phone: candidate.phone || '',
    currentCompany: candidate.currentCompany || '',
    links: candidate.links || [],
    expectedSalary: candidate.expectedSalary || '',
    skills: candidate.skills || [],
    source: candidate.source || '',
    positionId: candidate.positionId || '',
    status: candidate.status || 'new',
    phoneScreenResult: candidate.phoneScreenResult || '',
    pageUrl: candidate.pageUrl || '',
    advanceReason: candidate.advanceReason || '',
    rejectReason: candidate.rejectReason || '',
    notes: candidate.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  candidates.push(newCandidate);
  await saveCandidates(candidates);
  return newCandidate;
}

async function updateCandidate(id, updates) {
  const candidates = await getCandidates();
  const index = candidates.findIndex(c => c.id === id);
  if (index === -1) return null;
  candidates[index] = { ...candidates[index], ...updates, updatedAt: new Date().toISOString() };
  await saveCandidates(candidates);
  return candidates[index];
}

async function deleteCandidate(id) {
  let candidates = await getCandidates();
  candidates = candidates.filter(c => c.id !== id);
  await saveCandidates(candidates);
  let interviews = await getInterviews();
  interviews = interviews.filter(i => i.candidateId !== id);
  await saveInterviews(interviews);
  let reminders = await getReminders();
  reminders = reminders.filter(r => r.candidateId !== id);
  await saveReminders(reminders);
  return true;
}

async function findCandidateByUrl(url) {
  const candidates = await getCandidates();
  return candidates.filter(c => c.pageUrl === url);
}

async function getInterviews() {
  return getData(STORAGE_KEYS.INTERVIEWS);
}

async function saveInterviews(interviews) {
  return setData(STORAGE_KEYS.INTERVIEWS, interviews);
}

async function addInterview(interview) {
  const interviews = await getInterviews();
  const newInterview = {
    id: generateId(),
    candidateId: interview.candidateId || '',
    positionId: interview.positionId || '',
    round: interview.round || 1,
    type: interview.type || 'phone',
    date: interview.date || '',
    questions: interview.questions || [],
    evaluation: interview.evaluation || '',
    rating: interview.rating || 0,
    interviewer: interview.interviewer || '',
    result: interview.result || 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  interviews.push(newInterview);
  await saveInterviews(interviews);
  return newInterview;
}

async function updateInterview(id, updates) {
  const interviews = await getInterviews();
  const index = interviews.findIndex(i => i.id === id);
  if (index === -1) return null;
  interviews[index] = { ...interviews[index], ...updates, updatedAt: new Date().toISOString() };
  await saveInterviews(interviews);
  return interviews[index];
}

async function deleteInterview(id) {
  let interviews = await getInterviews();
  interviews = interviews.filter(i => i.id !== id);
  await saveInterviews(interviews);
  return true;
}

async function getInterviewsByCandidate(candidateId) {
  const interviews = await getInterviews();
  return interviews.filter(i => i.candidateId === candidateId);
}

async function getReminders() {
  return getData(STORAGE_KEYS.REMINDERS);
}

async function saveReminders(reminders) {
  return setData(STORAGE_KEYS.REMINDERS, reminders);
}

async function addReminder(reminder) {
  const reminders = await getReminders();
  const newReminder = {
    id: generateId(),
    candidateId: reminder.candidateId || '',
    candidateName: reminder.candidateName || '',
    type: reminder.type || 'follow_up',
    scheduledTime: reminder.scheduledTime || '',
    completed: false,
    note: reminder.note || '',
    createdAt: new Date().toISOString()
  };
  reminders.push(newReminder);
  await saveReminders(reminders);
  return newReminder;
}

async function updateReminder(id, updates) {
  const reminders = await getReminders();
  const index = reminders.findIndex(r => r.id === id);
  if (index === -1) return null;
  reminders[index] = { ...reminders[index], ...updates };
  await saveReminders(reminders);
  return reminders[index];
}

async function deleteReminder(id) {
  let reminders = await getReminders();
  reminders = reminders.filter(r => r.id !== id);
  await saveReminders(reminders);
  return true;
}

async function getPendingReminders() {
  const reminders = await getReminders();
  const now = new Date().toISOString();
  return reminders.filter(r => !r.completed && r.scheduledTime <= now);
}

async function exportCandidatesCSV(positionId) {
  const candidates = await getCandidates();
  const positions = await getPositions();
  const interviews = await getInterviews();
  let filtered = positionId ? candidates.filter(c => c.positionId === positionId) : candidates;

  const headers = ['姓名', '邮箱', '电话', '当前公司', '期望薪资', '技能', '来源渠道', '职位', '状态', '电话筛选结果', '推进原因', '淘汰原因', '备注', '页面链接', '创建时间'];
  const rows = filtered.map(c => {
    const pos = positions.find(p => p.id === c.positionId);
    const candidateInterviews = interviews.filter(i => i.candidateId === c.id);
    const statusMap = { new: '新候选人', phone_screen: '电话筛选中', interviewing: '面试中', offered: '已发offer', rejected: '已淘汰', hired: '已录用' };
    return [
      c.name,
      c.email,
      c.phone,
      c.currentCompany,
      c.expectedSalary,
      (c.skills || []).join('; '),
      c.source,
      pos ? pos.title : '',
      statusMap[c.status] || c.status,
      c.phoneScreenResult,
      c.advanceReason,
      c.rejectReason,
      c.notes,
      c.pageUrl,
      c.createdAt
    ];
  });

  const escapeCSV = (val) => {
    const str = String(val || '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const csvContent = [headers, ...rows].map(row => row.map(escapeCSV).join(',')).join('\n');
  return '\uFEFF' + csvContent;
}
