/* =========================================================
   form.js — Framework Feedback submission form

   STORAGE NOTE (read this before deploying):
   This is a fully static, serverless-friendly build (works as-is on
   Netlify, Vercel, GitHub Pages, etc. — no backend required). Submissions
   are persisted with the browser's localStorage, under the key below.
   That means submissions are private to *this browser on this device* —
   they will not appear for other visitors or on other devices.

   If you need everyone's submissions to land in one shared place, the
   two common serverless-friendly upgrades are:
     1. Netlify Forms (netlify.com/products/forms) — add a
        `data-netlify="true"` attribute to the <form>, no JS storage code
        needed, submissions collect in your Netlify dashboard.
     2. A small serverless function (Netlify Functions / Vercel Functions)
        that writes to a database (FaunaDB, Supabase, Airtable, etc.) —
        swap the localStorage calls below for a fetch() to that function.
   ========================================================= */

const STORAGE_KEY = 'frameworkSubmissions';

const form           = document.getElementById('feedbackForm');
const nameInput      = document.getElementById('yourName');
const likesInput     = document.getElementById('likesFramework');
const serviceInput   = document.getElementById('serviceLine');
const fileInput      = document.getElementById('docFile');
const dropzone       = document.getElementById('dropzone');
const docTitleEl     = document.getElementById('docTitle');
const metaExtEl      = document.getElementById('metaExt');
const metaDateEl     = document.getElementById('metaDate');
const fileNamePrev   = document.getElementById('fileNamePreview');
const formStatus     = document.getElementById('formStatus');

const nameError      = document.getElementById('nameError');
const serviceError   = document.getElementById('serviceError');
const fileError      = document.getElementById('fileError');

metaDateEl.textContent = new Date().toLocaleDateString(undefined, {
  year: 'numeric', month: 'short', day: 'numeric'
});

/* ---------- title-from-filename behaviour ---------- */

function stripExtension(filename) {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) return filename; // no extension, or dotfile like ".gitignore"
  return filename.slice(0, lastDot);
}

function extensionOf(filename) {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === filename.length - 1) return '';
  return filename.slice(lastDot + 1).toUpperCase();
}

function updateTitleFromFile(file) {
  if (!file) {
    docTitleEl.textContent = 'Upload a document to name this sheet';
    docTitleEl.classList.add('is-placeholder');
    metaExtEl.hidden = true;
    fileNamePrev.textContent = '';
    return;
  }

  const titleText = stripExtension(file.name) || file.name;
  const ext = extensionOf(file.name);

  docTitleEl.textContent = titleText;
  docTitleEl.classList.remove('is-placeholder');

  // retrigger the stamp animation
  docTitleEl.classList.remove('is-stamped');
  // eslint-disable-next-line no-unused-expressions
  void docTitleEl.offsetWidth; // force reflow so the animation restarts
  docTitleEl.classList.add('is-stamped');

  if (ext) {
    metaExtEl.textContent = `.${ext}`;
    metaExtEl.hidden = false;
  } else {
    metaExtEl.hidden = true;
  }

  fileNamePrev.textContent = file.name;
  fileError.hidden = true;
}

fileInput.addEventListener('change', () => {
  updateTitleFromFile(fileInput.files[0] || null);
});

// basic drag-and-drop support on the dropzone
['dragenter', 'dragover'].forEach(evt =>
  dropzone.addEventListener(evt, e => {
    e.preventDefault();
    dropzone.classList.add('is-dragover');
  })
);
['dragleave', 'drop'].forEach(evt =>
  dropzone.addEventListener(evt, e => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
  })
);
dropzone.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  if (file) {
    fileInput.files = e.dataTransfer.files;
    updateTitleFromFile(file);
  }
});

/* ---------- validation ---------- */

function validate() {
  let valid = true;

  const nameOk = nameInput.value.trim().length > 0;
  nameError.hidden = nameOk;
  if (!nameOk) valid = false;

  const serviceOk = !!serviceInput.value;
  serviceError.hidden = serviceOk;
  if (!serviceOk) valid = false;

  const fileOk = fileInput.files && fileInput.files.length > 0;
  fileError.hidden = fileOk;
  if (!fileOk) valid = false;

  return valid;
}

/* ---------- helpers ---------- */

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadSubmissions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Could not read existing submissions:', err);
    return [];
  }
}

function saveSubmissions(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function showStatus(message, type) {
  formStatus.innerHTML =
    `<div class="status-banner status-banner--${type}">${message}</div>`;
}

/* ---------- submit handler ---------- */

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formStatus.innerHTML = '';

  if (!validate()) {
    showStatus('Please fix the highlighted fields before submitting.', 'error');
    return;
  }

  const file = fileInput.files[0];
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Saving…';

  try {
    const fileData = await readFileAsDataURL(file);

    const submission = {
      id: (crypto.randomUUID && crypto.randomUUID()) ||
          `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: stripExtension(file.name) || file.name,
      name: nameInput.value.trim(),
      likesFramework: likesInput.checked,
      serviceLine: serviceInput.options[serviceInput.selectedIndex].text,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      fileData, // base64 data URL
      submittedAt: new Date().toISOString(),
    };

    const submissions = loadSubmissions();
    submissions.push(submission);
    saveSubmissions(submissions);

    showStatus('Sheet saved. Redirecting to results…', 'ok');
    window.location.href = 'results.html';

  } catch (err) {
    console.error(err);
    if (err && err.name === 'QuotaExceededError') {
      showStatus(
        'This file is too large to store in the browser (localStorage limit). Try a smaller file, or wire up server-side storage — see the note at the top of form.js.',
        'error'
      );
    } else {
      showStatus('Something went wrong saving your submission. Please try again.', 'error');
    }
    submitButton.disabled = false;
    submitButton.textContent = 'Submit sheet';
  }
});
