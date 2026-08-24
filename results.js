/* =========================================================
   results.js — renders submitted sheets from the shared
   Supabase project, grouped by form (the uploaded document's
   title). The top level lists each distinct form; clicking one
   drills into the list of people who submitted it, and clicking
   a person opens the existing detail overlay with their full
   answers and a link to the uploaded file.
   Storage note: see the header comment in form.js.
   ========================================================= */

const resultsContent  = document.getElementById('resultsContent');
const exportExcelBtn  = document.getElementById('exportExcelBtn');

const overlay          = document.getElementById('overlay');
const detailTitle      = document.getElementById('detailTitle');
const detailEyebrow    = document.getElementById('detailEyebrow');
const detailExt        = document.getElementById('detailExt');
const detailDate       = document.getElementById('detailDate');
const detailFields     = document.getElementById('detailFields');
const detailDownload   = document.getElementById('detailDownload');
const closeDetailBtn   = document.getElementById('closeDetailBtn');

// null = showing the list of forms; otherwise the form key currently drilled into
let currentFormKey = null;

// Last-fetched submissions, so row clicks can read synchronously without a re-fetch.
let cachedSubmissions = [];

function mapRow(row) {
  return {
    id: row.id,
    title: row.title,
    name: row.name,
    likesFramework: row.likes_framework,
    serviceLine: row.service_line,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    filePath: row.file_path,
    submittedAt: row.submitted_at,
  };
}

async function fetchSubmissions() {
  const { data, error } = await supabaseClient
    .from('submissions')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('Could not load submissions:', error);
    return null;
  }
  return (data || []).map(mapRow);
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

function formKeyOf(s) {
  return (s.title || s.fileName || '').trim() || 'Untitled';
}

function groupByForm(submissions) {
  const groups = new Map();
  for (const s of submissions) {
    const key = formKeyOf(s);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return groups;
}

async function render() {
  resultsContent.innerHTML = `<div class="empty-state">Loading submissions…</div>`;

  const submissions = await fetchSubmissions();

  if (submissions === null) {
    exportExcelBtn.hidden = true;
    resultsContent.innerHTML = `
      <div class="empty-state">
        <strong>Couldn't load submissions</strong>
        There was a problem reaching the shared database. Check your connection and try again.
      </div>`;
    return;
  }

  cachedSubmissions = submissions;
  exportExcelBtn.hidden = submissions.length === 0;

  if (submissions.length === 0) {
    currentFormKey = null;
    resultsContent.innerHTML = `
      <div class="empty-state">
        <strong>No sheets submitted yet</strong>
        Nothing has been filed yet. Submit the form to see it listed here.
        <br /><br />
        <a class="link-quiet" href="index.html">Go to the submission form →</a>
      </div>`;
    return;
  }

  // Fall back to the forms list if the drilled-into form has no submissions left.
  if (currentFormKey && !submissions.some(s => formKeyOf(s) === currentFormKey)) {
    currentFormKey = null;
  }

  if (currentFormKey) {
    renderFormDetail(submissions, currentFormKey);
  } else {
    renderFormsList(submissions);
  }
}

function renderFormsList(submissions) {
  const groups = groupByForm(submissions);

  const forms = Array.from(groups.entries())
    .map(([key, entries]) => {
      const sorted = entries.slice().sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      return { key, entries: sorted, latest: sorted[0] };
    })
    .sort((a, b) => new Date(b.latest.submittedAt) - new Date(a.latest.submittedAt));

  const rows = forms.map((f, i) => {
    const num = String(forms.length - i).padStart(2, '0');
    const ext = extensionOf(f.latest.fileName || '');
    const yesCount = f.entries.filter(e => e.likesFramework).length;
    const pillClass = yesCount === 0 ? 'pill--no' : 'pill--yes';
    return `
      <tr class="results-row" tabindex="0" data-key="${escapeHtml(f.key)}">
        <td class="col-num">${num}</td>
        <td>${escapeHtml(f.key)}${ext ? ` <span class="badge-ext">.${ext}</span>` : ''}</td>
        <td>${f.entries.length}</td>
        <td><span class="pill ${pillClass}">${yesCount}/${f.entries.length} yes</span></td>
        <td>${formatDate(f.latest.submittedAt)}</td>
      </tr>`;
  }).join('');

  resultsContent.innerHTML = `
    <div class="table-wrap">
      <table class="results-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Form / Document</th>
            <th>Submissions</th>
            <th>Likes it?</th>
            <th>Last submitted</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  document.querySelectorAll('.results-row').forEach(row => {
    const openForm = () => { currentFormKey = row.dataset.key; render(); };
    row.addEventListener('click', openForm);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openForm();
      }
    });
  });
}

function renderFormDetail(submissions, formKey) {
  const entries = submissions
    .filter(s => formKeyOf(s) === formKey)
    .slice()
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  const rows = entries.map((s, i) => {
    const num = String(entries.length - i).padStart(2, '0');
    return `
      <tr class="results-row" tabindex="0" data-id="${s.id}">
        <td class="col-num">${num}</td>
        <td>${escapeHtml(s.name || '—')}</td>
        <td><span class="pill ${s.likesFramework ? 'pill--yes' : 'pill--no'}">${s.likesFramework ? 'Yes' : 'No'}</span></td>
        <td>${escapeHtml(s.serviceLine || '—')}</td>
        <td>${formatDate(s.submittedAt)}</td>
      </tr>`;
  }).join('');

  resultsContent.innerHTML = `
    <div class="form-detail-header">
      <button class="link-quiet back-link" id="backToFormsBtn" type="button">← Back to all forms</button>
      <h2 class="form-detail-title">${escapeHtml(formKey)}</h2>
      <div class="form-detail-sub">${entries.length} submission${entries.length === 1 ? '' : 's'}</div>
    </div>
    <div class="table-wrap">
      <table class="results-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Likes it?</th>
            <th>Service Line</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  document.getElementById('backToFormsBtn').addEventListener('click', () => {
    currentFormKey = null;
    render();
  });

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
  const s = cachedSubmissions.find(x => x.id === id);
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

  if (s.filePath) {
    const { data } = supabaseClient.storage.from(SUPABASE_DOCUMENTS_BUCKET).getPublicUrl(s.filePath);
    detailDownload.href = data.publicUrl;
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

exportExcelBtn.addEventListener('click', () => {
  const submissions = cachedSubmissions
    .slice()
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  if (submissions.length === 0) return;

  const rows = submissions.map(s => ({
    'Form / Document': formKeyOf(s),
    'Name': s.name || '',
    'Likes Framework': s.likesFramework ? 'Yes' : 'No',
    'Service Line': s.serviceLine || '',
    'File Name': s.fileName || '',
    'File Size': formatBytes(s.fileSize),
    'Submitted At': formatDate(s.submittedAt),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Submissions');

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `framework-submissions-${today}.xlsx`);
});

render();
