/* =========================================================
   form.js — Framework Feedback submission form

   STORAGE NOTE:
   This is a fully static, serverless-friendly build (works as-is on
   Netlify, Vercel, GitHub Pages, etc. — no backend required). Submissions
   go straight from the browser to a shared Supabase project (see
   supabase-config.js): the answers as a row in the `submissions` table,
   and the uploaded file in the `documents` storage bucket. Everyone who
   opens results.html sees the same shared list.

   This uses Supabase's public "publishable" key, which only works within
   the Row Level Security policies set on the project (currently: anyone
   can insert a submission, no auth). Never put the database password or
   a service-role key in client-side code.
   ========================================================= */

const form           = document.getElementById('feedbackForm');
const honeypotInput  = document.getElementById('companyWebsite');
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

function showStatus(message, type) {
  formStatus.innerHTML =
    `<div class="status-banner status-banner--${type}">${message}</div>`;
}

/* ---------- submit handler ---------- */

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formStatus.innerHTML = '';

  if (honeypotInput && honeypotInput.value.trim() !== '') {
    // Almost certainly a bot. Pretend it worked so it doesn't adapt, but
    // don't actually write anything.
    showStatus('Sheet saved. Redirecting to results…', 'ok');
    setTimeout(() => { window.location.href = 'results.html'; }, 400);
    return;
  }

  if (!validate()) {
    showStatus('Please fix the highlighted fields before submitting.', 'error');
    return;
  }

  const file = fileInput.files[0];
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.textContent = 'Saving…';

  try {
    const submissionId = (crypto.randomUUID && crypto.randomUUID()) ||
        `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const filePath = `${submissionId}/${file.name}`;

    const { error: uploadError } = await supabaseClient.storage
      .from(SUPABASE_DOCUMENTS_BUCKET)
      .upload(filePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { error: insertError } = await supabaseClient
      .from('submissions')
      .insert({
        id: submissionId,
        title: stripExtension(file.name) || file.name,
        name: nameInput.value.trim(),
        likes_framework: likesInput.checked,
        service_line: serviceInput.options[serviceInput.selectedIndex].text,
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
        file_path: filePath,
      });
    if (insertError) throw insertError;

    showStatus('Sheet saved. Redirecting to results…', 'ok');
    window.location.href = 'results.html';

  } catch (err) {
    console.error(err);
    showStatus(
      `Something went wrong saving your submission${err && err.message ? `: ${err.message}` : ''}. Please try again.`,
      'error'
    );
    submitButton.disabled = false;
    submitButton.textContent = 'Submit sheet';
  }
});
