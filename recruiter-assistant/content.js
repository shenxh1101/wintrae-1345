chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ status: 'ok' });
  }

  if (message.type === 'SHOW_DUPLICATE_ALERT') {
    showDuplicateAlert(message.candidate);
    sendResponse({ status: 'shown' });
  }
  
  if (message.type === 'CANDIDATE_SAVED') {
    showDuplicateAlert(message.candidate);
    sendResponse({ status: 'shown' });
  }
});

function showDuplicateAlert(candidate) {
  const existing = document.getElementById('ra-duplicate-alert');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ra-duplicate-alert';
  overlay.innerHTML = `
    <div class="ra-alert-content">
      <div class="ra-alert-header">
        <span class="ra-alert-icon">📋</span>
        <span class="ra-alert-title">Recruiter Assistant 提示</span>
        <button class="ra-alert-close" id="ra-alert-close">&times;</button>
      </div>
      <div class="ra-alert-body">
        <p>该候选人已有记录：</p>
        <div class="ra-alert-info">
          <strong>${candidate.name || '未命名'}</strong>
          ${candidate.currentCompany ? '<span>当前公司: ' + candidate.currentCompany + '</span>' : ''}
          <span>状态: ${getStatusText(candidate.status)}</span>
          <span>添加时间: ${formatDate(candidate.createdAt)}</span>
        </div>
      </div>
      <div class="ra-alert-footer">
        <button class="ra-alert-btn ra-alert-btn-primary" id="ra-alert-open">打开侧边栏查看</button>
        <button class="ra-alert-btn ra-alert-btn-secondary" id="ra-alert-dismiss">知道了</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('ra-alert-close').addEventListener('click', () => overlay.remove());
  document.getElementById('ra-alert-dismiss').addEventListener('click', () => overlay.remove());
  document.getElementById('ra-alert-open').addEventListener('click', () => {
    overlay.remove();
    chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' });
  });

  setTimeout(() => {
    if (document.getElementById('ra-duplicate-alert')) {
      overlay.remove();
    }
  }, 15000);
}

function getStatusText(status) {
  const map = {
    new: '新候选人',
    phone_screen: '电话筛选中',
    interviewing: '面试中',
    offered: '已发offer',
    rejected: '已淘汰',
    hired: '已录用'
  };
  return map[status] || status;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN');
}

async function checkForDuplicates() {
  try {
    const url = window.location.href;
    const response = await chrome.runtime.sendMessage({
      type: 'CHECK_DUPLICATE',
      url: url
    });
    if (response && response.count > 0) {
      showDuplicateAlert(response.duplicates[0]);
    }
  } catch (e) {}
}

const observer = new MutationObserver(() => {});
observer.observe(document.body, { childList: true, subtree: true });

setTimeout(checkForDuplicates, 2000);
