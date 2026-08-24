/* =========================================================
   results.js — renders submitted sheets from localStorage
   and shows a clickable detail panel per row.
   Storage note: see the header comment in form.js.
   ========================================================= */

const STORAGE_KEY = 'frameworkSubmissions';

const resultsContent = document.getElementById('resultsContent');
const clearAllBtn    = document.getElementById('clearAllBtn');

const overlay          = document.getElementById('overlay');
const detailTitle      = document.getElementById('detailTitle');
const detailEyebrow    = document.getElementById('detailEyebrow');
const detailExt        = document.getElementById('detailExt');
const detailDate       = document.getElementById('detailDate');
const detailFields     = document.getElementById('detailFields');
const detailDownload   = document.getElementById('detailDownload');
const closeDetailBtn   = document.getElementById('closeDetailBtn');

function loadSubmissions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('Could not read submissions:', err);
    return [];
  }
}

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extensionOf(filename) {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === filename.length - 1) return '';
  return filename.slice(lastDot + 1).toUpperCase();
}

function render() {
  const submissions = loadSubmissions()
    .slice()
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  clearAllBtn.hidden = submissions.length === 0;

  if (submissions.length === 0) {
    resultsContent.innerHTML = `
      <div class="empty-state">
        <strong>No sheets submitted yet</strong>
        Nothing has been filed in this browser. Submit the form to see it listed here.
        <br /><br />
        <a class="link-quiet" href="index.html">Go to the submission form →</a>
      </div>`;
    return;
  }

  const rows = submissions.map((s, i) => {
    const num = String(submissions.length - i).padStart(2, '0');
    const ext = extensionOf(s.fileName || '');
    return `
      <tr class="results-row" tabindex="0" data-id="${s.id}">
        <td class="col-num">${num}</td>
        <td>${escapeHtml(s.title || s.fileName || 'Untitled')}</td>
        <td>${escapeHtml(s.name || '—')}</td>
        <td><span class="pill ${s.likesFramework ? 'pill--yes' : 'pill--no'}">${s.likesFramework ? 'Yes' : 'No'}</span></td>
        <td>${escapeHtml(s.serviceLine || '—')}</td>
        <td>${escapeHtml(s.fileName || '—')}${ext ? ` <span class="badge-ext">.${ext}</span>` : ''}</td>
        <td>${formatDate(s.submittedAt)}</td>
      </tr>`;
  }).join('');

  resultsContent.innerHTML = `
    <div class="table-wrap">
      <table class="results-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Name</th>
            <th>Likes it?</th>
            <th>Service Line</th>
            <th>Document</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  document.querySelectorAll('.results-row').forEach(row => {
    row.addEventListener('click', () => openDetail(row.dataset.id));
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetail(row.dataset.id);
      }
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function openDetail(id) {
  const submissions = loadSubmissions();
  const s = submissions.find(x => x.id === id);
  if (!s) return;

  const ext = extensionOf(s.fileName || '');

  detailEyebrow.textContent = 'Sheet Detail';
  detailTitle.textContent = s.title || s.fileName || 'Untitled';
  detailDate.textContent = formatDate(s.submittedAt);
  if (ext) {
    detailExt.textContent = `.${ext}`;
    detailExt.hidden = false;
  } else {
    detailExt.hidden = true;
  }

  detailFields.innerHTML = `
    <div class="detail-row"><dt>Your Name</dt><dd>${escapeHtml(s.name || '—')}</dd></div>
    <div class="detail-row"><dt>Likes framework</dt><dd>${s.likesFramework ? 'Yes' : 'No'}</dd></div>
    <div class="detail-row"><dt>Service Line</dt><dd>${escapeHtml(s.serviceLine || '—')}</dd></div>
    <div class="detail-row"><dt>File name</dt><dd>${escapeHtml(s.fileName || '—')}</dd></div>
    <div class="detail-row"><dt>File size</dt><dd>${formatBytes(s.fileSize)}</dd></div>
  `;

  if (s.fileData) {
    detailDownload.href = s.fileData;
    detailDownload.setAttribute('download', s.fileName || 'document');
    detailDownload.hidden = false;
  } else {
    detailDownload.hidden = true;
  }

  overlay.classList.add('is-open');
  closeDetailBtn.focus();
}

function closeDetail() {
  overlay.classList.remove('is-open');
}

closeDetailBtn.addEventListener('click', closeDetail);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeDetail();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDetail();
});

clearAllBtn.addEventListener('click', () => {
  if (confirm('Remove all submitted sheets from this browser? This cannot be undone.')) {
    localStorage.removeItem(STORAGE_KEY);
    render();
  }
});

render();
