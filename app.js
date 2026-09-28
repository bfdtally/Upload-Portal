const PROJECT_URL = "https://qgaanudqzldzjdmaskhu.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_0ZbjxqmRXbcqVhnzLgA7Mg_T7s8_Nwe";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_TOTAL_SIZE = 200 * 1024 * 1024;

const database = window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY);
const $ = (selector) => document.querySelector(selector);
const state = { files: [], submissions: [], collections: [] };
const requestedCollection = new URLSearchParams(location.search).get("class");
// Uploads always use the public role, even while the owner is signed in.
const uploadDatabase = window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "dropdesk-upload" } });
const views = {
  upload: $("#uploadView"),
  success: $("#successView"),
  login: $("#adminLoginView"),
  admin: $("#adminView"),
};

function showView(name) {
  Object.entries(views).forEach(([key, element]) => { element.hidden = key !== name; });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
}[character]));

const createId = () => crypto.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
const safeName = (name) => name.replace(/[^a-zA-Z0-9._-]/g, "_");
const fileExt = (name) => (name.split(".").pop() || "FILE").slice(0, 4).toUpperCase();

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 2600);
}

function showNotice(selector, message, error = false) {
  const element = $(selector);
  element.textContent = message;
  element.classList.toggle("error", error);
  element.hidden = false;
}

function clearNotice(selector) {
  const element = $(selector);
  element.hidden = true;
  element.textContent = "";
}

function renderFiles() {
  $("#fileList").innerHTML = state.files.map((file, index) => `
    <div class="file-row">
      <span class="file-type">${escapeHtml(fileExt(file.name))}</span>
      <span class="file-meta"><strong>${escapeHtml(file.name)}</strong><small>${formatBytes(file.size)}</small></span>
      <button class="remove-file" type="button" data-index="${index}" aria-label="Remove ${escapeHtml(file.name)}">×</button>
    </div>`).join("");
}

function addFiles(fileList) {
  clearNotice("#uploadNotice");
  const incoming = [...fileList];
  if (incoming.some((file) => file.size > MAX_FILE_SIZE)) {
    showNotice("#uploadNotice", "Each file must be 50 MB or smaller.", true);
    return;
  }
  const combined = [...state.files, ...incoming].filter((file, index, all) =>
    index === all.findIndex((item) => item.name === file.name && item.size === file.size));
  if (combined.length > 10) {
    showNotice("#uploadNotice", "You can upload no more than 10 files at once.", true);
    return;
  }
  if (combined.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_SIZE) {
    showNotice("#uploadNotice", "The combined upload must be 200 MB or smaller.", true);
    return;
  }
  state.files = combined;
  renderFiles();
}

$("#dropZone").addEventListener("click", () => $("#fileInput").click());
$("#dropZone").addEventListener("keydown", (event) => {
  if (["Enter", " "].includes(event.key)) { event.preventDefault(); $("#fileInput").click(); }
});
$("#fileInput").addEventListener("change", (event) => { addFiles(event.target.files); event.target.value = ""; });
["dragenter", "dragover"].forEach((type) => $("#dropZone").addEventListener(type, (event) => {
  event.preventDefault(); $("#dropZone").classList.add("dragging");
}));
["dragleave", "drop"].forEach((type) => $("#dropZone").addEventListener(type, (event) => {
  event.preventDefault(); $("#dropZone").classList.remove("dragging");
}));
$("#dropZone").addEventListener("drop", (event) => addFiles(event.dataTransfer.files));
$("#fileList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-index]");
  if (!button) return;
  state.files.splice(Number(button.dataset.index), 1);
  renderFiles();
});
$("#message").addEventListener("input", (event) => { $("#charCount").textContent = event.target.value.length; });

$("#uploadForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice("#uploadNotice");
  const collectionId = $("#collectionSelect").value;
  if (!state.collections.some(group => group.id === collectionId)) return showNotice("#uploadNotice", "Choose your class or camp first.", true);
  if (!state.files.length) return showNotice("#uploadNotice", "Add at least one file to continue.", true);

  const button = $("#submitButton");
  const submissionId = createId();
  const uploadedFiles = [];
  button.disabled = true;

  try {
    for (let index = 0; index < state.files.length; index += 1) {
      const file = state.files[index];
      button.firstChild.textContent = `Uploading ${index + 1} of ${state.files.length}… `;
      const path = `submissions/${submissionId}/${createId()}-${safeName(file.name)}`;
      const result = await uploadDatabase.storage.from("client-uploads").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (result.error) throw result.error;
      uploadedFiles.push({ name: file.name, path, size: file.size, type: file.type || "application/octet-stream" });
    }

    button.firstChild.textContent = "Saving submission… ";
    const submission = {
      id: submissionId,
      collection_id: collectionId,
      full_name: $("#fullName").value.trim(),
      email: $("#email").value.trim(),
      message: $("#message").value.trim(),
      files: uploadedFiles,
      status: "new",
    };
    const result = await uploadDatabase.from("submissions").insert(submission);
    if (result.error) throw result.error;

    $("#successName").textContent = submission.full_name.split(" ")[0];
    $("#successEmail").textContent = submission.email;
    $("#successCollection").textContent = collectionName(collectionId);
    $("#receipt").innerHTML = uploadedFiles.map((file) => `
      <div class="receipt-row"><svg viewBox="0 0 18 18"><path d="M5 2h5l4 4v10H5zM10 2v4h4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg><span>${escapeHtml(file.name)}</span><small>${formatBytes(file.size)}</small></div>`).join("");
    state.files = [];
    renderFiles();
    event.target.reset();
    $("#collectionSelect").value = collectionId;
    $("#charCount").textContent = "0";
    showView("success");
  } catch (error) {
    showNotice("#uploadNotice", error.message || "The upload failed. Please try again.", true);
  } finally {
    button.disabled = false;
    button.firstChild.textContent = "Send files securely ";
  }
});

$("#sendMore").addEventListener("click", () => showView("upload"));
$("#loginBack").addEventListener("click", () => showView("upload"));
$("#backToPortal").addEventListener("click", () => showView("upload"));

$("#adminLink").addEventListener("click", async () => {
  const { data } = await database.auth.getSession();
  if (data.session) {
    showView("admin");
    loadDashboard();
  } else {
    showView("login");
  }
});

$("#adminLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearNotice("#loginNotice");
  const button = $("#loginButton");
  button.disabled = true;
  button.textContent = "Signing in…";
  const result = await database.auth.signInWithPassword({
    email: $("#adminEmail").value.trim(),
    password: $("#adminPassword").value,
  });
  button.disabled = false;
  button.textContent = "Sign in securely";
  if (result.error) return showNotice("#loginNotice", "Incorrect email or password.", true);
  $("#adminPassword").value = "";
  showView("admin");
  loadDashboard();
});

$("#logoutButton").addEventListener("click", async () => {
  await database.auth.signOut();
  state.submissions = [];
  showView("upload");
});
$("#refreshAdmin").addEventListener("click", loadDashboard);
$("#searchInput").addEventListener("input", renderDashboard);
$("#statusFilter").addEventListener("change", renderDashboard);

async function loadDashboard() {
  await loadCollections();
  clearNotice("#adminNotice");
  $("#submissionList").innerHTML = '<div class="empty-state">Loading submissions…</div>';
  const rows = [];
  let result;
  for (let offset = 0; ; offset += 500) {
    result = await database.from("submissions").select("*").order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
    if (result.error) break;
    rows.push(...result.data);
    if (result.data.length < 500) break;
  }
  if (result.error) {
    showNotice("#adminNotice", result.error.message, true);
    $("#submissionList").innerHTML = '<div class="empty-state">Unable to load submissions.</div>';
    return;
  }
  state.submissions = rows;
  await Promise.all(state.submissions.map(prepareDropboxLinks));
  renderDashboard();
}

function filesOf(submission) {
  if (Array.isArray(submission.files)) return submission.files;
  try { return JSON.parse(submission.files || "[]"); } catch { return []; }
}

function previewKind(file) {
  const type = String(file.type || "").toLowerCase();
  const extension = String(file.name || "").split(".").pop().toLowerCase();
  if (type.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic"].includes(extension)) return "image";
  if (type === "application/pdf" || extension === "pdf") return "pdf";
  if (type.startsWith("video/") || ["mp4", "webm", "mov", "m4v"].includes(extension)) return "video";
  if (type.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg"].includes(extension)) return "audio";
  if (type.startsWith("text/") || ["txt", "csv", "json", "md", "log", "xml"].includes(extension)) return "text";
  return null;
}

async function prepareDropboxLinks(submission) {
  const files = filesOf(submission);
  if (!files.length || submission.status === "archived") {
    submission.dropboxFiles = [];
    return;
  }
  const links = await Promise.all(files.map(async (file) => {
    const result = await database.storage.from("client-uploads").createSignedUrl(file.path, 3600);
    return result.error ? null : { url: result.data.signedUrl, filename: file.name };
  }));
  submission.dropboxFiles = links.filter(Boolean);
}

function renderDashboard() {
  const query = $("#searchInput").value.toLowerCase().trim();
  const filter = $("#statusFilter").value;
  const groupFilter = $("#collectionFilter").value;
  const archiveFilter = $("#archiveFilter").value;
  const filtered = state.submissions.filter((item) => {
    const files = filesOf(item);
    const haystack = `${item.full_name} ${item.email} ${files.map((file) => file.name).join(" ")}`.toLowerCase();
    return (!query || haystack.includes(query)) && (filter === "all" || item.status === filter)
      && (groupFilter === "all" || (item.collection_id || "unassigned") === groupFilter)
      && (archiveFilter === "all" || (archiveFilter === "archived" ? !!item.archived_at : !item.archived_at));
  });

  const allFiles = filtered.flatMap(filesOf);
  $("#totalSubmissions").textContent = filtered.length;
  $("#totalFiles").textContent = allFiles.length;
  $("#storageUsed").textContent = formatBytes(allFiles.reduce((total, file) => total + Number(file.size || 0), 0));

  if (!filtered.length) {
    $("#submissionList").innerHTML = `<div class="empty-state"><strong>${state.submissions.length ? "No matching submissions" : "Your drop-off desk is ready"}</strong><span>${state.submissions.length ? "Try another search or filter." : "New uploads will appear here automatically."}</span></div>`;
    return;
  }

  $("#submissionList").innerHTML = filtered.map((item) => {
    const files = filesOf(item);
    const initials = item.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    const fileButtons = files.map((file, index) => {
      const preview = previewKind(file) ? `<button class="preview-file" type="button" data-preview-id="${item.id}" data-file-index="${index}">Preview</button> ` : "";
      return `${preview}<button class="download-file" type="button" data-download-id="${item.id}" data-file-index="${index}">↓ ${escapeHtml(file.name)}</button>`;
    }).join(" ");
    const archived = item.status === "archived";
    const dropboxReady = item.dropboxFiles?.length === files.length && files.length > 0;
    return `<article class="submission-row">
      <span class="avatar">${escapeHtml(initials)}</span>
      <span class="person"><strong>${escapeHtml(item.full_name)}</strong><small>${escapeHtml(item.email)}</small><span class="submission-note">${escapeHtml(collectionName(item.collection_id))} · ${escapeHtml(item.message || "No note")}</span>
      <label class="move-label">Move to<select data-move-id="${item.id}" aria-label="Move submission to group"><option value="">Unassigned</option>${state.collections.map(group => `<option value="${group.id}" ${group.id === item.collection_id ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("")}</select></label></span>
      <span class="submission-files"><strong>${files.length} file${files.length === 1 ? "" : "s"} · ${formatBytes(files.reduce((total, file) => total + Number(file.size || 0), 0))}</strong><small>${fileButtons} <button class="archive-file" type="button" data-dropbox-id="${item.id}" ${archived || !dropboxReady ? "disabled" : ""}>${archived ? "✓ Saved to Dropbox" : dropboxReady ? "Save to Dropbox" : "Preparing Dropbox…"}</button></small></span>
      <span class="date-cell"><button class="secondary-button" type="button" data-archive-id="${item.id}">${item.archived_at ? "Restore to inbox" : "Archive"}</button><br>${new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
      <button class="status-btn ${escapeHtml(item.status)}" type="button" data-status-id="${item.id}" ${archived ? "disabled" : ""}>${escapeHtml(item.status)}</button>
    </article>`;
  }).join("");
}

$("#submissionList").addEventListener("click", async (event) => {
  const archiveButton = event.target.closest("[data-archive-id]");
  if (archiveButton) {
    const item = state.submissions.find(row => row.id === archiveButton.dataset.archiveId);
    const archived_at = item.archived_at ? null : new Date().toISOString();
    archiveButton.disabled = true;
    const result = await database.from("submissions").update({ archived_at }).eq("id", item.id).select("id");
    if (result.error || !result.data?.length) { archiveButton.disabled = false; return showNotice("#adminNotice", result.error?.message || "Could not update this submission. Sign in again.", true); }
    item.archived_at = archived_at;
    renderDashboard();
    return;
  }
  const dropboxButton = event.target.closest("[data-dropbox-id]");
  if (dropboxButton) {
    const submission = state.submissions.find((item) => item.id === dropboxButton.dataset.dropboxId);
    if (!submission || submission.status === "archived" || !submission.dropboxFiles?.length) return;
    if (!window.Dropbox?.save) {
      showNotice("#adminNotice", "Dropbox Saver could not load. Confirm that upload-portal-sthp.onrender.com is listed in your Dropbox app domains.", true);
      return;
    }
    clearNotice("#adminNotice");
    window.Dropbox.save({
      files: submission.dropboxFiles,
      success: async () => {
        const result = await database.from("submissions").update({ status: "archived" }).eq("id", submission.id);
        if (result.error) {
          showNotice("#adminNotice", "Files reached Dropbox, but DropDesk could not mark them archived.", true);
          return;
        }
        submission.status = "archived";
        submission.dropboxFiles = [];
        toast("Files saved to Dropbox");
        renderDashboard();
      },
      cancel: () => {},
      error: (message) => showNotice("#adminNotice", `Dropbox could not save these files: ${message}`, true),
    });
    return;
  }

  const previewButton = event.target.closest("[data-preview-id]");
  if (previewButton) {
    const submission = state.submissions.find((item) => item.id === previewButton.dataset.previewId);
    const file = submission && filesOf(submission)[Number(previewButton.dataset.fileIndex)];
    if (file) openPreview(file);
    return;
  }

  const downloadButton = event.target.closest("[data-download-id]");
  if (downloadButton) {
    const popup = window.open("", "_blank");
    const submission = state.submissions.find((item) => item.id === downloadButton.dataset.downloadId);
    const file = submission && filesOf(submission)[Number(downloadButton.dataset.fileIndex)];
    if (!file) { popup?.close(); return; }
    const result = await database.storage.from("client-uploads").createSignedUrl(file.path, 120);
    if (result.error) {
      popup?.close();
      showNotice("#adminNotice", result.error.message, true);
    } else if (popup) {
      popup.location = result.data.signedUrl;
    } else {
      window.location.href = result.data.signedUrl;
    }
    return;
  }

  const statusButton = event.target.closest("[data-status-id]");
  if (!statusButton) return;
  const submission = state.submissions.find((item) => item.id === statusButton.dataset.statusId);
  if (submission.status === "archived") return;
  const status = submission.status === "new" ? "reviewed" : "new";
  const result = await database.from("submissions").update({ status }).eq("id", submission.id);
  if (result.error) return showNotice("#adminNotice", result.error.message, true);
  submission.status = status;
  renderDashboard();
});

async function openPreview(file) {
  const modal = $("#previewModal");
  const body = $("#previewBody");
  $("#previewTitle").textContent = file.name;
  $("#previewMeta").textContent = `${file.type || "File"} · ${formatBytes(Number(file.size || 0))}`;
  body.replaceChildren(Object.assign(document.createElement("span"), { className: "preview-loading", textContent: "Preparing secure preview…" }));
  modal.hidden = false;
  document.body.style.overflow = "hidden";

  const result = await database.storage.from("client-uploads").createSignedUrl(file.path, 300);
  if (result.error) {
    body.textContent = result.error.message;
    return;
  }

  const url = result.data.signedUrl;
  $("#previewDownload").href = url;
  const kind = previewKind(file);
  let viewer;
  if (kind === "image") viewer = Object.assign(document.createElement("img"), { src: url, alt: file.name });
  if (kind === "pdf") viewer = Object.assign(document.createElement("iframe"), { src: url, title: file.name });
  if (kind === "video") { viewer = document.createElement("video"); viewer.src = url; viewer.controls = true; }
  if (kind === "audio") { viewer = document.createElement("audio"); viewer.src = url; viewer.controls = true; }
  if (kind === "text") {
    viewer = document.createElement("pre");
    try { viewer.textContent = await fetch(url).then((response) => response.text()); }
    catch { viewer.textContent = "This text preview could not be loaded."; }
  }
  if (!viewer) viewer = Object.assign(document.createElement("span"), { className: "preview-loading", textContent: "This file type must be downloaded to view." });
  body.replaceChildren(viewer);
}

function closePreview() {
  $("#previewModal").hidden = true;
  $("#previewBody").replaceChildren();
  $("#previewDownload").href = "#";
  document.body.style.overflow = "";
}

$("#previewClose").addEventListener("click", closePreview);
$("#previewModal").addEventListener("click", (event) => { if (event.target === event.currentTarget) closePreview(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("#previewModal").hidden) closePreview(); });

function collectionName(id) {
  return state.collections.find(group => group.id === id)?.name || "Unassigned";
}

async function loadCollections() {
  const result = await database.from("collections").select("id,name,kind,slug").order("name");
  if (result.error) {
    showNotice("#uploadNotice", "Classes could not load. Refresh to try again.", true);
    return;
  }
  state.collections = result.data || [];
  const selected = $("#collectionSelect").value;
  const filter = $("#collectionFilter").value;
  const options = state.collections.map(group => `<option value="${group.id}">${escapeHtml(group.name)}</option>`).join("");
  $("#collectionSelect").innerHTML = '<option value="">Choose your class or camp</option>' + options;
  $("#collectionSelect").disabled = false;
  const linked = state.collections.find(group => group.slug === requestedCollection);
  $("#collectionSelect").value = linked?.id || selected;
  $("#collectionHint").textContent = requestedCollection && !linked ? "This class link was not found. Please choose your class or ask your instructor." : linked ? `You’re uploading to ${linked.name}.` : "Choose the group your instructor shared with you.";
  $("#collectionFilter").innerHTML = '<option value="all">All groups</option><option value="unassigned">Unassigned</option>' + options;
  $("#collectionFilter").value = filter || "all";
  $("#collectionList").innerHTML = state.collections.map(group => `<div class="group-card"><span><strong>${escapeHtml(group.name)}</strong><small>${escapeHtml(group.kind)}</small></span><button class="secondary-button" type="button" data-copy-group="${group.id}">Copy student link</button></div>`).join("");
}
$("#collectionSelect").addEventListener("change", () => {
  $("#collectionHint").textContent = $("#collectionSelect").value ? `You’re uploading to ${collectionName($("#collectionSelect").value)}.` : "Choose your class or camp.";
});
$("#collectionForm").addEventListener("submit", async event => {
  event.preventDefault();
  const name = $("#collectionName").value.trim();
  if (!name) return;
  const button = event.target.querySelector("button");
  button.disabled = true;
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "group";
  const slug = `${base}-${createId().slice(0, 8)}`;
  const result = await database.from("collections").insert({ name, kind: $("#collectionKind").value, slug }).select("id");
  button.disabled = false;
  if (result.error || !result.data?.length) return showNotice("#adminNotice", result.error?.message || "Could not create group.", true);
  event.target.reset();
  await loadCollections();
  renderDashboard();
  toast("Group created. Copy its student link to share.");
});
$("#collectionList").addEventListener("click", async event => {
  const button = event.target.closest("[data-copy-group]");
  if (!button) return;
  const group = state.collections.find(item => item.id === button.dataset.copyGroup);
  const url = new URL(location.href);
  url.search = ""; url.hash = "";
  url.searchParams.set("class", group.slug);
  try { await navigator.clipboard.writeText(url.href); toast("Student link copied"); }
  catch { showNotice("#adminNotice", `Student link: ${url.href}`); }
});
$("#submissionList").addEventListener("change", async event => {
  const select = event.target.closest("[data-move-id]");
  if (!select) return;
  const item = state.submissions.find(row => row.id === select.dataset.moveId);
  const collection_id = select.value || null;
  select.disabled = true;
  const result = await database.from("submissions").update({ collection_id }).eq("id", item.id).select("id");
  select.disabled = false;
  if (result.error || !result.data?.length) { select.value = item.collection_id || ""; return showNotice("#adminNotice", result.error?.message || "Could not move submission.", true); }
  item.collection_id = collection_id;
  renderDashboard();
});
$("#collectionFilter").addEventListener("change", renderDashboard);
$("#archiveFilter").addEventListener("change", renderDashboard);
loadCollections();
