const API = "http://127.0.0.1:8000";

// ── Extract user from JWT token ────────────────────────────
function getUserFromToken() {
  const token = localStorage.getItem("access_token");
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(atob(base64).split("").map(char => `%${("00" + char.charCodeAt(0).toString(16)).slice(-2)}`).join(""));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

let USER_ID = null;
let USER_NAME = null;
const userPayload = getUserFromToken();
if (userPayload) {
  USER_NAME = userPayload.sub;
}

// ── State ─────────────────────────────────────────────────
let folders      = [];
let notes        = [];
let activeFolder = null;
let activeNote   = null;
let isDirty      = false;  // unsaved changes flag

// ── DOM ───────────────────────────────────────────────────
const folderList        = document.getElementById("folder-list");
const notesList         = document.getElementById("notes-list");
const folderTitle       = document.getElementById("folder-title");
const newFolderBtn      = document.getElementById("new-folder-btn");
const newNoteBtn        = document.getElementById("new-note-btn");
const logoutBtn         = document.getElementById("logout-button");
const emptyState        = document.getElementById("empty-state");
const noteWorkspace     = document.getElementById("note-workspace");
const noteTitleInput    = document.getElementById("note-title-input");
const noteEditor        = document.getElementById("note-editor");
const noteMeta          = document.getElementById("note-meta");
const saveBtn           = document.getElementById("save-btn");
const saveIndicator     = document.getElementById("save-indicator");
const deleteNoteBtn     = document.getElementById("delete-note-btn");
const btnWrite          = document.getElementById("btn-write");
const btnPreview        = document.getElementById("btn-preview");
const writePanel        = document.getElementById("write-panel");
const previewPanel      = document.getElementById("preview-panel");
const previewContent    = document.getElementById("preview-content");
const sidebarUsername   = document.getElementById("sidebar-username");
const avatarLetter      = document.getElementById("avatar-letter");

// Folder modal
const folderModal       = document.getElementById("folder-modal");
const folderNameInput   = document.getElementById("folder-name-input");
const folderCancelBtn   = document.getElementById("folder-cancel-btn");
const folderConfirmBtn  = document.getElementById("folder-confirm-btn");

// Note modal (title only)
const noteModal         = document.getElementById("note-modal");
const newNoteTitleInput = document.getElementById("new-note-title-input");
const noteCancelBtn     = document.getElementById("note-cancel-btn");
const noteConfirmBtn    = document.getElementById("note-confirm-btn");

const toastEl           = document.getElementById("toast");
let toastTimer;

// ── Toast ─────────────────────────────────────────────────
function toast(msg, isError = false) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.className   = "toast" + (isError ? " error" : "");
  toastEl.classList.remove("hidden");
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 2800);
}

// ── Dirty state ───────────────────────────────────────────
function markDirty() {
  if (!activeNote) return;
  isDirty = true;
  saveIndicator.style.opacity = "1";
  saveBtn.disabled = false;
  saveBtn.classList.remove("opacity-40", "cursor-not-allowed");
}

function markClean() {
  isDirty = false;
  saveIndicator.style.opacity = "0";
  saveBtn.disabled = true;
  saveBtn.classList.add("opacity-40", "cursor-not-allowed");
}

// ── API helper ────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { 
    method, 
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${localStorage.getItem("access_token") || ""}`
    } 
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) {
    if (res.status === 401) {
      window.location.href = "index.html";
      return;
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// ── Date helper ───────────────────────────────────────────
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ── Render sidebar ────────────────────────────────────────
function renderFolders() {
  folderList.innerHTML = "";
  if (!folders.length) {
    folderList.innerHTML = `<p class="text-xs text-slate-500 px-2 pt-2">No folders yet.</p>`;
    return;
  }
  folders.forEach(f => {
    const el = document.createElement("div");
    el.className = "folder-item" + (activeFolder?.id === f.id ? " active" : "");
    el.innerHTML = `
      <svg class="folder-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <span class="truncate flex-1">${escHtml(f.name)}</span>
    `;
    el.addEventListener("click", () => confirmSwitchThen(() => selectFolder(f)));
    folderList.appendChild(el);
  });
}

function renderNotes() {
  notesList.innerHTML = "";
  if (!notes.length) {
    notesList.innerHTML = `<p class="text-xs text-slate-500 px-2 pt-2">No notes yet.</p>`;
    return;
  }
  notes.forEach(n => {
    const el = document.createElement("div");
    el.className = "note-item" + (activeNote?.id === n.id ? " active" : "");
    el.innerHTML = `
      <div class="note-item-title">${escHtml(n.title)}</div>
      <div class="note-item-date">${fmtDate(n.updated_at || n.created_at)}</div>
    `;
    el.addEventListener("click", () => confirmSwitchThen(() => selectNote(n.id)));
    notesList.appendChild(el);
  });
}

// ── Guard: warn user about unsaved changes ────────────────
function confirmSwitchThen(fn) {
  if (isDirty) {
    if (!confirm("You have unsaved changes. Discard them?")) return;
    markClean();
  }
  fn();
}

// ── Select folder ─────────────────────────────────────────
async function selectFolder(f) {
  activeFolder = f;
  activeNote   = null;
  folderTitle.textContent = f.name;
  newNoteBtn.classList.remove("hidden");
  showEmpty();
  renderFolders();
  try {
    notes = await api("GET", `/folders/${f.id}/notes`);
  } catch (e) {
    notes = [];
    toast(e.message, true);
  }
  renderNotes();
}

// ── Select note (load into editor) ────────────────────────
async function selectNote(id) {
  try {
    activeNote = await api("GET", `/notes/${id}`);
    showWorkspace();
    noteTitleInput.value  = activeNote.title;
    noteEditor.value      = activeNote.content;
    noteMeta.textContent  = `Last updated ${fmtDate(activeNote.updated_at || activeNote.created_at)}`;
    markClean();
    setMode("write");
    renderNotes();
  } catch (e) {
    toast(e.message, true);
  }
}

// ── Show panels ───────────────────────────────────────────
function showEmpty() {
  emptyState.style.display = "flex";
  noteWorkspace.classList.add("hidden");
}
function showWorkspace() {
  emptyState.style.display = "none";
  noteWorkspace.classList.remove("hidden");
  noteWorkspace.style.display = "flex";
  noteWorkspace.style.flexDirection = "column";
}

// ── Write / Preview toggle ────────────────────────────────
function setMode(mode) {
  if (mode === "write") {
    writePanel.classList.remove("hidden");
    previewPanel.classList.add("hidden");
    btnWrite.classList.add("active");
    btnPreview.classList.remove("active");
  } else {
    previewContent.innerHTML = activeNote?.content_html || markdownFallback(noteEditor.value);
    writePanel.classList.add("hidden");
    previewPanel.classList.remove("hidden");
    btnWrite.classList.remove("active");
    btnPreview.classList.add("active");
  }
}
btnWrite.addEventListener("click",   () => setMode("write"));
btnPreview.addEventListener("click", () => setMode("preview"));

// ── Detect changes in editor ──────────────────────────────
noteTitleInput.addEventListener("input", markDirty);
noteEditor.addEventListener("input",     markDirty);

// ── Save note ─────────────────────────────────────────────
saveBtn.addEventListener("click", saveCurrentNote);

// Ctrl+S / Cmd+S shortcut
document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    if (!saveBtn.disabled) saveCurrentNote();
  }
});

async function saveCurrentNote() {
  if (!activeNote || !isDirty) return;
  const title   = noteTitleInput.value.trim();
  const content = noteEditor.value;
  if (!title) { toast("Title can't be empty.", true); return; }
  try {
    const updated = await api("PUT", `/notes/${activeNote.id}`, { title, content });
    activeNote = updated;
    const idx  = notes.findIndex(n => n.id === activeNote.id);
    if (idx !== -1) notes[idx] = updated;
    noteMeta.textContent = `Last updated ${fmtDate(updated.updated_at || updated.created_at)}`;
    markClean();
    renderNotes();
    toast("Saved.");
  } catch (e) {
    toast(e.message, true);
  }
}

// ── Delete note ───────────────────────────────────────────
deleteNoteBtn.addEventListener("click", async () => {
  if (!activeNote) return;
  if (!confirm(`Delete "${activeNote.title}"?`)) return;
  try {
    await api("DELETE", `/notes/${activeNote.id}`);
    notes = notes.filter(n => n.id !== activeNote.id);
    activeNote = null;
    markClean();
    showEmpty();
    renderNotes();
    toast("Note deleted.");
  } catch (e) {
    toast(e.message, true);
  }
});

// ── Folder modal ──────────────────────────────────────────
newFolderBtn.addEventListener("click", () => {
  folderNameInput.value = "";
  folderModal.classList.remove("hidden");
  setTimeout(() => folderNameInput.focus(), 50);
});
folderCancelBtn.addEventListener("click", () => folderModal.classList.add("hidden"));
folderConfirmBtn.addEventListener("click", createFolder);
folderNameInput.addEventListener("keydown", e => { if (e.key === "Enter") createFolder(); });

async function createFolder() {
  const name = folderNameInput.value.trim();
  if (!name) return;
  try {
    const f = await api("POST", `/folders/${USER_ID}/folders`, { name });
    folders.push(f);
    folderModal.classList.add("hidden");
    renderFolders();
    toast("Folder created.");
  } catch (e) {
    toast(e.message, true);
  }
}

// ── New Note modal ────────────────────────────────────────
newNoteBtn.addEventListener("click", () => {
  newNoteTitleInput.value = "";
  noteModal.classList.remove("hidden");
  setTimeout(() => newNoteTitleInput.focus(), 50);
});
noteCancelBtn.addEventListener("click", () => noteModal.classList.add("hidden"));
noteConfirmBtn.addEventListener("click", createNote);
newNoteTitleInput.addEventListener("keydown", e => { if (e.key === "Enter") createNote(); });

async function createNote() {
  if (!activeFolder) {
    toast("Select a folder first.", true);
    return;
  }
  const title = newNoteTitleInput.value.trim();
  if (!title) return;
  try {
    const created = await api("POST", `/notes/${activeFolder.id}/notes`, { title, content: "" });
    notes.unshift(created);
    noteModal.classList.add("hidden");
    renderNotes();
    await selectNote(created.id);
    noteEditor.focus();
    toast("Note created — start writing.");
  } catch (e) {
    toast(e.message, true);
  }
}

// ── Logout ────────────────────────────────────────────────
logoutBtn.addEventListener("click", () => {
  if (isDirty && !confirm("You have unsaved changes. Leave anyway?")) return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("token_type");
  localStorage.removeItem("expires_in");
  localStorage.removeItem("issued_at");
  window.location.href = "index.html";
});

// ── Minimal markdown fallback ─────────────────────────────
function markdownFallback(raw) {
  if (!raw) return "";
  let html = raw
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    // code blocks
    .replace(/```[\w]*\n?([\s\S]*?)```/g, (_,c) => `<pre><code>${c.trim()}</code></pre>`)
    // headings
    .replace(/^###### (.+)$/gm,"<h6>$1</h6>")
    .replace(/^##### (.+)$/gm,"<h5>$1</h5>")
    .replace(/^#### (.+)$/gm,"<h4>$1</h4>")
    .replace(/^### (.+)$/gm,"<h3>$1</h3>")
    .replace(/^## (.+)$/gm,"<h2>$1</h2>")
    .replace(/^# (.+)$/gm,"<h1>$1</h1>")
    // inline
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,"<em>$1</em>")
    .replace(/`([^`]+)`/g,"<code>$1</code>")
    // blockquote
    .replace(/^> (.+)$/gm,"<blockquote>$1</blockquote>")
    // lists
    .replace(/^[-*] (.+)$/gm,"<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, s=>`<ul>${s}</ul>`)
    // hr
    .replace(/^---$/gm,"<hr/>")
    // paragraphs
    .split(/\n\n+/).map(block => {
      if (/^<(h[1-6]|ul|ol|pre|blockquote|hr)/.test(block.trim())) return block;
      return `<p>${block.replace(/\n/g,"<br/>")}</p>`;
    }).join("\n");
  return html;
}

// ── Bootstrap ─────────────────────────────────────────────
async function init() {
  if (!USER_NAME) {
    window.location.href = "index.html";
    return;
  }
  
  try {
    sidebarUsername.textContent = USER_NAME;
    avatarLetter.textContent    = USER_NAME[0].toUpperCase();
    
    if (!USER_ID) {
      const user = await api("GET", `/users/by-username/${encodeURIComponent(USER_NAME)}`);
      USER_ID = user.id;
    }
    
    folders = await api("GET", `/users/${USER_ID}/folders`);
    renderFolders();
  } catch (e) {
    toast(e.message || "Can't reach the API. Is the server running?", true);
  }
}

if (localStorage.getItem("access_token")) {
  init();
} else {
  window.location.href = "index.html";
}