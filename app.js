const PROJECT_URL = "https://qgaanudqzldzjdmaskhu.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_0ZbjxqmRXbcqVhnzLgA7Mg_T7s8_Nwe";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_TOTAL_SIZE = 200 * 1024 * 1024;

const database = window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY);
const $ = (selector) => document.querySelector(selector);
const state = { files: [], submissions: [] };
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
      const result = await database.storage.from("client-uploads").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (result.error) throw result.error;
      uploadedFiles.push({ name: file.name, path, size: file.size, type: file.type || "application/octet-stream" });
    }

    button.firstChild.textContent = "Saving submission… ";
    const submission = {
      id: submissionId,
      full_name: $("#fullName").value.trim(),
      email: $("#email").value.trim(),
      message: $("#message").value.trim(),
      files: uploadedFiles,
      status: "new",
    };
    const result = await database.from("submissions").insert(submission);
    if (result.error) throw result.error;

    $("#successName").textContent = submission.full_name.split(" ")[0];
    $("#successEmail").textContent = submission.email;
    $("#receipt").innerHTML = uploadedFiles.map((file) => `
      <div class="receipt-row"><svg viewBox="0 0 18 18"><path d="M5 2h5l4 4v10H5zM10 2v4h4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg><span>${escapeHtml(file.name)}</span><small>${formatBytes(file.size)}</small></div>`).join("");
    state.files = [];
    renderFiles();
    event.target.reset();
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
  clearNotice("#adminNotice");
  $("#submissionList").innerHTML = '<div class="empty-state">Loading submissions…</div>';
  const result = await database.from("submissions").select("*").order("created_at", { ascending: false });
  if (result.error) {
    showNotice("#adminNotice", result.error.message, true);
    $("#submissionList").innerHTML = '<div class="empty-state">Unable to load submissions.</div>';
    return;
  }
  state.submissions = result.data || [];
  renderDashboard();
}

function filesOf(submission) {
  if (Array.isArray(submission.files)) return submission.files;
  try { return JSON.parse(submission.files || "[]"); } catch { return []; }
}

function renderDashboard() {
  const query = $("#searchInput").value.toLowerCase().trim();
  const filter = $("#statusFilter").value;
  const filtered = state.submissions.filter((item) => {
    const files = filesOf(item);
    const haystack = `${item.full_name} ${item.email} ${files.map((file) => file.name).join(" ")}`.toLowerCase();
    return (!query || haystack.includes(query)) && (filter === "all" || item.status === filter);
  });

  const allFiles = state.submissions.flatMap(filesOf);
  $("#totalSubmissions").textContent = state.submissions.length;
  $("#totalFiles").textContent = allFiles.length;
  $("#storageUsed").textContent = formatBytes(allFiles.reduce((total, file) => total + Number(file.size || 0), 0));

  if (!filtered.length) {
    $("#submissionList").innerHTML = `<div class="empty-state"><strong>${state.submissions.length ? "No matching submissions" : "Your drop-off desk is ready"}</strong><span>${state.submissions.length ? "Try another search or filter." : "New uploads will appear here automatically."}</span></div>`;
    return;
  }

  $("#submissionList").innerHTML = filtered.map((item) => {
    const files = filesOf(item);
    const initials = item.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    const fileButtons = files.map((file, index) => `<button class="download-file" type="button" data-download-id="${item.id}" data-file-index="${index}">↓ ${escapeHtml(file.name)}</button>`).join(" ");
    return `<article class="submission-row">
      <span class="avatar">${escapeHtml(initials)}</span>
      <span class="person"><strong>${escapeHtml(item.full_name)}</strong><small>${escapeHtml(item.email)}</small><span class="submission-note">${escapeHtml(item.message || "No note")}</span></span>
      <span class="submission-files"><strong>${files.length} file${files.length === 1 ? "" : "s"} · ${formatBytes(files.reduce((total, file) => total + Number(file.size || 0), 0))}</strong><small>${fileButtons}</small></span>
      <span class="date-cell">${new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
      <button class="status-btn ${escapeHtml(item.status)}" type="button" data-status-id="${item.id}">${escapeHtml(item.status)}</button>
    </article>`;
  }).join("");
}

$("#submissionList").addEventListener("click", async (event) => {
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
  const status = submission.status === "new" ? "reviewed" : "new";
  const result = await database.from("submissions").update({ status }).eq("id", submission.id);
  if (result.error) return showNotice("#adminNotice", result.error.message, true);
  submission.status = status;
  renderDashboard();
});
