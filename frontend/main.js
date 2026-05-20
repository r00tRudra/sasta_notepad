const API = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) ;//|| "https://sasta-notepad.vercel.app/";

// ── JWT decode ────────────────────────────────────────────
function getUserFromToken() {
  const token = localStorage.getItem("access_token");
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const base64  = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json    = decodeURIComponent(
      atob(base64).split("").map(c => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`).join("")
    );
    return JSON.parse(json);
  } catch { return null; }
}

let USER_ID   = null;
let USER_NAME = null;
const userPayload = getUserFromToken();
if (userPayload) USER_NAME = userPayload.sub;

// ── State ─────────────────────────────────────────────────
let folders      = [];
let notes        = [];
let activeFolder = null;
let activeNote   = null;
let isDirty      = false;

// ── DOM refs ──────────────────────────────────────────────
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
const folderModal       = document.getElementById("folder-modal");
const folderNameInput   = document.getElementById("folder-name-input");
const folderCancelBtn   = document.getElementById("folder-cancel-btn");
const folderConfirmBtn  = document.getElementById("folder-confirm-btn");
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
    if (res.status === 401) { window.location.href = "index.html"; return; }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// ── Utils ─────────────────────────────────────────────────
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ─────────────────────────────────────────────────────────
// ── RESIZABLE PANELS ──────────────────────────────────────
// ─────────────────────────────────────────────────────────

function initResizeHandles() {
  const sidebarPanel = document.getElementById("sidebar-panel");
  const notesPanel   = document.getElementById("notes-panel");
  const handle1      = document.getElementById("resize-1");
  const handle2      = document.getElementById("resize-2");

  makeResizable(handle1, sidebarPanel, 160, 480);
  makeResizable(handle2, notesPanel,   140, 420);
}

function makeResizable(handle, target, minW, maxW) {
  let startX, startW;
  handle.addEventListener("mousedown", e => {
    e.preventDefault();
    startX = e.clientX;
    startW = target.offsetWidth;
    handle.classList.add("active");
    document.body.style.cursor      = "col-resize";
    document.body.style.userSelect  = "none";
    document.body.style.pointerEvents = "none";
    handle.style.pointerEvents = "auto";

    const onMove = e => {
      const w = Math.max(minW, Math.min(maxW, startW + (e.clientX - startX)));
      target.style.width = w + "px";
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      handle.classList.remove("active");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.body.style.pointerEvents = "";
      handle.style.pointerEvents = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
}

// ─────────────────────────────────────────────────────────
// ── CONTEXT MENU ──────────────────────────────────────────
// ─────────────────────────────────────────────────────────

const ctxMenu = document.createElement("div");
ctxMenu.className = "ctx-menu hidden";
document.body.appendChild(ctxMenu);

function showContextMenu(x, y, items) {
  ctxMenu.innerHTML = "";
  items.forEach(item => {
    if (item === "sep") {
      const s = document.createElement("div");
      s.className = "ctx-sep";
      ctxMenu.appendChild(s);
      return;
    }
    const el = document.createElement("div");
    el.className = "ctx-item" + (item.danger ? " ctx-danger" : "");
    el.innerHTML = (item.icon || "") + `<span>${escHtml(item.label)}</span>`;
    el.addEventListener("mousedown", e => e.stopPropagation());
    el.addEventListener("click", e => {
      e.stopPropagation();
      hideContextMenu();
      item.action();
    });
    ctxMenu.appendChild(el);
  });

  ctxMenu.classList.remove("hidden");

  // Clamp to viewport
  const cw = 184;
  const ch = ctxMenu.scrollHeight || items.length * 34;
  const left = Math.min(x, window.innerWidth  - cw - 8);
  const top  = Math.min(y, window.innerHeight - ch - 8);
  ctxMenu.style.left = left + "px";
  ctxMenu.style.top  = top  + "px";
}

function hideContextMenu() {
  ctxMenu.classList.add("hidden");
}

document.addEventListener("click", hideContextMenu);
document.addEventListener("keydown", e => { if (e.key === "Escape") hideContextMenu(); });

// ── SVG icons ─────────────────────────────────────────────
const ICON = {
  pencil: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  copy:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  move:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`,
  trash:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  open:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  folder: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
};

// ─────────────────────────────────────────────────────────
// ── FOLDER ACTIONS ────────────────────────────────────────
// ─────────────────────────────────────────────────────────

function folderContextMenu(e, f) {
  e.preventDefault();
  e.stopPropagation();
  showContextMenu(e.clientX, e.clientY, [
    { label: "Rename folder",  icon: ICON.pencil, action: () => renameFolder(f)  },
    "sep",
    { label: "Delete folder",  icon: ICON.trash,  action: () => deleteFolder(f), danger: true },
  ]);
}

async function renameFolder(f) {
  const name = prompt("Rename folder:", f.name);
  if (!name || name.trim() === f.name) return;
  try {
    const updated = await api("PUT", `/folders/${f.id}`, { name: name.trim() });
    const newName = updated?.name ?? name.trim();
    const idx = folders.findIndex(x => x.id === f.id);
    if (idx !== -1) folders[idx].name = newName;
    if (activeFolder?.id === f.id) {
      activeFolder.name = newName;
      folderTitle.textContent = newName;
    }
    renderFolders();
    toast("Folder renamed.");
  } catch (err) { toast(err.message, true); }
}

async function deleteFolder(f) {
  if (!confirm(`Delete folder "${f.name}" and ALL its notes? This cannot be undone.`)) return;
  try {
    await api("DELETE", `/folders/${f.id}`);
    folders = folders.filter(x => x.id !== f.id);
    if (activeFolder?.id === f.id) {
      activeFolder = null; activeNote = null;
      folderTitle.textContent = "Select a folder";
      newNoteBtn.classList.add("hidden");
      notes = []; showEmpty(); renderNotes();
    }
    renderFolders();
    toast("Folder deleted.");
  } catch (err) { toast(err.message, true); }
}

// ─────────────────────────────────────────────────────────
// ── NOTE ACTIONS ──────────────────────────────────────────
// ─────────────────────────────────────────────────────────

function noteContextMenu(e, n) {
  e.preventDefault();
  e.stopPropagation();
  showContextMenu(e.clientX, e.clientY, [
    { label: "Open note",         icon: ICON.open,   action: () => confirmSwitchThen(() => selectNote(n.id)) },
    { label: "Rename",            icon: ICON.pencil, action: () => renameNotePrompt(n)   },
    { label: "Duplicate",         icon: ICON.copy,   action: () => duplicateNote(n)      },
    { label: "Copy to folder…",   icon: ICON.folder, action: () => copyNoteToFolder(n)   },
    "sep",
    { label: "Delete",            icon: ICON.trash,  action: () => deleteNoteById(n), danger: true },
  ]);
}

async function renameNotePrompt(n) {
  const title = prompt("Rename note:", n.title);
  if (!title || title.trim() === n.title) return;
  try {
    // Use cached content if this is the active note, otherwise fetch
    let content = "";
    if (activeNote?.id === n.id) {
      content = noteEditor.value;
    } else {
      const full = await api("GET", `/notes/${n.id}`);
      content = full.content || "";
    }
    const updated = await api("PUT", `/notes/${n.id}`, { title: title.trim(), content });
    const newTitle = updated?.title ?? title.trim();
    const idx = notes.findIndex(x => x.id === n.id);
    if (idx !== -1) notes[idx].title = newTitle;
    if (activeNote?.id === n.id) {
      activeNote.title = newTitle;
      noteTitleInput.value = newTitle;
    }
    renderNotes();
    toast("Note renamed.");
  } catch (err) { toast(err.message, true); }
}

async function duplicateNote(n) {
  if (!activeFolder) return;
  try {
    const full = await api("GET", `/notes/${n.id}`);
    const copy = await api("POST", `/notes/${activeFolder.id}/notes`, {
      title:   full.title + " (copy)",
      content: full.content || ""
    });
    notes.unshift(copy);
    renderNotes();
    toast("Note duplicated.");
  } catch (err) { toast(err.message, true); }
}

async function copyNoteToFolder(n) {
  const others = folders.filter(f => f.id !== activeFolder?.id);
  if (!others.length) { toast("No other folders to copy to.", true); return; }
  const list  = others.map((f, i) => `${i + 1}. ${f.name}`).join("\n");
  const input = prompt(`Copy "${n.title}" to which folder?\n\n${list}\n\nEnter the number:`);
  if (!input) return;
  const idx = parseInt(input, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= others.length) { toast("Invalid selection.", true); return; }
  const dest = others[idx];
  try {
    const full = await api("GET", `/notes/${n.id}`);
    await api("POST", `/notes/${dest.id}/notes`, { title: full.title, content: full.content || "" });
    toast(`Copied to "${dest.name}".`);
  } catch (err) { toast(err.message, true); }
}

async function deleteNoteById(n) {
  if (!confirm(`Delete "${n.title}"?`)) return;
  try {
    await api("DELETE", `/notes/${n.id}`);
    notes = notes.filter(x => x.id !== n.id);
    if (activeNote?.id === n.id) { activeNote = null; markClean(); showEmpty(); }
    renderNotes();
    toast("Note deleted.");
  } catch (err) { toast(err.message, true); }
}

// ─────────────────────────────────────────────────────────
// ── DRAG AND DROP ─────────────────────────────────────────
// ─────────────────────────────────────────────────────────

let draggedNoteId = null;

async function handleNoteDrop(noteId, destFolder) {
  if (destFolder.id === activeFolder?.id) {
    toast("Note is already in this folder.", false);
    return;
  }
  try {
    const full = await api("GET", `/notes/${noteId}`);
    await api("POST", `/notes/${destFolder.id}/notes`, {
      title:   full.title,
      content: full.content || ""
    });
    toast(`Copied to "${destFolder.name}".`);
  } catch (err) { toast("Could not copy note.", true); }
}

// ─────────────────────────────────────────────────────────
// ── RENDER ────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────

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
      <svg class="folder-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <span class="truncate flex-1">${escHtml(f.name)}</span>
    `;

    // Click to select
    el.addEventListener("click", () => confirmSwitchThen(() => selectFolder(f)));
    // Right-click context menu
    el.addEventListener("contextmenu", e => folderContextMenu(e, f));

    // Drop target for dragged notes
    el.addEventListener("dragover", e => {
      if (!draggedNoteId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      el.classList.add("drag-over");
    });
    el.addEventListener("dragleave", e => {
      if (!el.contains(e.relatedTarget)) el.classList.remove("drag-over");
    });
    el.addEventListener("drop", e => {
      e.preventDefault();
      el.classList.remove("drag-over");
      if (!draggedNoteId) return;
      handleNoteDrop(draggedNoteId, f);
    });

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
    el.setAttribute("draggable", "true");
    el.innerHTML = `
      <div class="note-item-title">${escHtml(n.title)}</div>
      <div class="note-item-date">${fmtDate(n.updated_at || n.created_at)}</div>
    `;

    // Click to open
    el.addEventListener("click", () => confirmSwitchThen(() => selectNote(n.id)));
    // Right-click context menu
    el.addEventListener("contextmenu", e => noteContextMenu(e, n));

    // Drag to copy
    el.addEventListener("dragstart", e => {
      draggedNoteId = n.id;
      e.dataTransfer.effectAllowed = "copy";
      el.classList.add("dragging");

      // Custom drag ghost
      const ghost = document.createElement("div");
      ghost.textContent = "📄 " + n.title;
      ghost.style.cssText = [
        "position:fixed", "top:-200px", "left:-200px",
        "background:#0f172a", "color:#a3e635",
        "border:1px solid rgba(163,230,53,0.35)",
        "padding:6px 14px", "border-radius:8px",
        "font-size:12px", "font-family:inherit",
        "white-space:nowrap", "pointer-events:none"
      ].join(";");
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      requestAnimationFrame(() => document.body.removeChild(ghost));
    });

    el.addEventListener("dragend", () => {
      el.classList.remove("dragging");
      draggedNoteId = null;
      // Clean up any lingering drag-over states
      document.querySelectorAll(".folder-item.drag-over").forEach(el => el.classList.remove("drag-over"));
    });

    notesList.appendChild(el);
  });
}

// ── Guard ─────────────────────────────────────────────────
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

// ── Select note ───────────────────────────────────────────
async function selectNote(id) {
  try {
    activeNote = await api("GET", `/notes/${id}`);
    showWorkspace();
    noteTitleInput.value = activeNote.title;
    noteEditor.value     = activeNote.content;
    noteMeta.textContent = `Last updated ${fmtDate(activeNote.updated_at || activeNote.created_at)}`;
    markClean();
    setMode("write");
    renderNotes();
  } catch (e) { toast(e.message, true); }
}

// ── Show panels ───────────────────────────────────────────
function showEmpty() {
  emptyState.style.display = "flex";
  noteWorkspace.classList.add("hidden");
}
function showWorkspace() {
  emptyState.style.display = "none";
  noteWorkspace.classList.remove("hidden");
  noteWorkspace.style.display       = "flex";
  noteWorkspace.style.flexDirection = "column";
}

// ─────────────────────────────────────────────────────────
// ── MARKDOWN RENDERING ────────────────────────────────────
// ─────────────────────────────────────────────────────────

function initMarkdown() {
  if (typeof marked === "undefined") return;
  // Configure marked for GFM (tables, strikethrough, task lists, autolinks)
  marked.use({
    gfm:    true,
    breaks: true,
  });
}

function renderMarkdown(raw) {
  if (!raw) return "";

  // Use marked if available (full GFM support)
  if (typeof marked !== "undefined") {
    try {
      return marked.parse(raw);
    } catch (e) {
      console.warn("marked.parse failed, falling back:", e);
    }
  }

  // Fallback: basic markdown
  return markdownFallback(raw);
}

// Fallback for when marked.js doesn't load
function markdownFallback(raw) {
  if (!raw) return "";
  let html = raw
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // fenced code blocks
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, c) =>
      `<pre><code class="language-${lang || 'text'}">${c.trim()}</code></pre>`)
    // headings
    .replace(/^###### (.+)$/gm, "<h6>$1</h6>")
    .replace(/^##### (.+)$/gm,  "<h5>$1</h5>")
    .replace(/^#### (.+)$/gm,   "<h4>$1</h4>")
    .replace(/^### (.+)$/gm,    "<h3>$1</h3>")
    .replace(/^## (.+)$/gm,     "<h2>$1</h2>")
    .replace(/^# (.+)$/gm,      "<h1>$1</h1>")
    // inline styles
    .replace(/~~(.+?)~~/g,        "<del>$1</del>")
    .replace(/\*\*(.+?)\*\*/g,    "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,        "<em>$1</em>")
    .replace(/`([^`]+)`/g,        "<code>$1</code>")
    // task lists
    .replace(/^- \[x\] (.+)$/gim, '<li><input type="checkbox" checked disabled> $1</li>')
    .replace(/^- \[ \] (.+)$/gim, '<li><input type="checkbox" disabled> $1</li>')
    // blockquote
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // unordered lists
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, s => `<ul>${s}</ul>`)
    // hr
    .replace(/^---$/gm, "<hr/>")
    // paragraphs
    .split(/\n\n+/).map(block => {
      if (/^<(h[1-6]|ul|ol|pre|blockquote|hr)/.test(block.trim())) return block;
      return `<p>${block.replace(/\n/g, "<br/>")}</p>`;
    }).join("\n");
  return html;
}

// ─────────────────────────────────────────────────────────
// ── WRITE / PREVIEW TOGGLE ────────────────────────────────
// ─────────────────────────────────────────────────────────

function setMode(mode) {
  if (mode === "write") {
    writePanel.classList.remove("hidden");
    previewPanel.classList.add("hidden");
    btnWrite.classList.add("active");
    btnPreview.classList.remove("active");
  } else {
    // Render markdown
    previewContent.innerHTML = renderMarkdown(noteEditor.value);

    // Apply syntax highlighting to all code blocks
    if (typeof hljs !== "undefined") {
      previewContent.querySelectorAll("pre code").forEach(el => {
        try { hljs.highlightElement(el); } catch (e) {}
      });
    }

    writePanel.classList.add("hidden");
    previewPanel.classList.remove("hidden");
    btnWrite.classList.remove("active");
    btnPreview.classList.add("active");
  }
}

btnWrite.addEventListener("click",   () => setMode("write"));
btnPreview.addEventListener("click", () => setMode("preview"));

// ─────────────────────────────────────────────────────────
// ── EDITOR EVENTS ─────────────────────────────────────────
// ─────────────────────────────────────────────────────────

noteTitleInput.addEventListener("input", markDirty);
noteEditor.addEventListener("input",     markDirty);

// Tab key → 2 spaces
noteEditor.addEventListener("keydown", e => {
  if (e.key === "Tab") {
    e.preventDefault();
    const s = noteEditor.selectionStart, end = noteEditor.selectionEnd;
    noteEditor.value =
      noteEditor.value.substring(0, s) + "  " + noteEditor.value.substring(end);
    noteEditor.selectionStart = noteEditor.selectionEnd = s + 2;
    markDirty();
  }
});

// ─────────────────────────────────────────────────────────
// ── SAVE ──────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────

saveBtn.addEventListener("click", saveCurrentNote);
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
    const idx = notes.findIndex(n => n.id === activeNote.id);
    if (idx !== -1) notes[idx] = updated;
    noteMeta.textContent = `Last updated ${fmtDate(updated.updated_at || updated.created_at)}`;
    markClean();
    renderNotes();
    toast("Saved.");
  } catch (e) { toast(e.message, true); }
}

// ─────────────────────────────────────────────────────────
// ── DELETE (toolbar button) ───────────────────────────────
// ─────────────────────────────────────────────────────────

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
  } catch (e) { toast(e.message, true); }
});

// ─────────────────────────────────────────────────────────
// ── FOLDER MODAL ──────────────────────────────────────────
// ─────────────────────────────────────────────────────────

newFolderBtn.addEventListener("click", () => {
  folderNameInput.value = "";
  folderModal.classList.remove("hidden");
  setTimeout(() => folderNameInput.focus(), 50);
});
folderCancelBtn.addEventListener("click",  () => folderModal.classList.add("hidden"));
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
  } catch (e) { toast(e.message, true); }
}

// ─────────────────────────────────────────────────────────
// ── NOTE MODAL ────────────────────────────────────────────
// ─────────────────────────────────────────────────────────

newNoteBtn.addEventListener("click", () => {
  newNoteTitleInput.value = "";
  noteModal.classList.remove("hidden");
  setTimeout(() => newNoteTitleInput.focus(), 50);
});
noteCancelBtn.addEventListener("click",  () => noteModal.classList.add("hidden"));
noteConfirmBtn.addEventListener("click", createNote);
newNoteTitleInput.addEventListener("keydown", e => { if (e.key === "Enter") createNote(); });

async function createNote() {
  if (!activeFolder) { toast("Select a folder first.", true); return; }
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
  } catch (e) { toast(e.message, true); }
}

// ─────────────────────────────────────────────────────────
// ── LOGOUT ────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────

logoutBtn.addEventListener("click", () => {
  if (isDirty && !confirm("You have unsaved changes. Leave anyway?")) return;
  ["access_token", "refresh_token", "token_type", "expires_in", "issued_at"]
    .forEach(k => localStorage.removeItem(k));
  window.location.href = "index.html";
});

// ─────────────────────────────────────────────────────────
// ── BOOTSTRAP ─────────────────────────────────────────────
// ─────────────────────────────────────────────────────────

async function init() {
  if (!USER_NAME) { window.location.href = "index.html"; return; }

  initMarkdown();
  initResizeHandles();

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

if (localStorage.getItem("access_token")) { init(); }
else { window.location.href = "index.html"; }