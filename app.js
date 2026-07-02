const MAX_FILE_SIZE = 250 * 1024 * 1024;
const DB_NAME = "dropdesk-files";
const STORE_NAME = "submissions";

const $ = (selector) => document.querySelector(selector);
const state = { files: [], submissions: JSON.parse(localStorage.getItem("dropdesk-submissions") || "[]") };

const views = { upload: $("#uploadView"), success: $("#successView"), admin: $("#adminView") };
const showView = (name) => {
  Object.entries(views).forEach(([key, element]) => { element.hidden = key !== name; });
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const formatBytes = (bytes) => {
  if (!bytes) return "0 MB";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  return `${(bytes / 1024 ** i).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
};
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
const fileExt = (name) => (name.split(".").pop() || "FILE").slice(0, 4).toUpperCase();
const toast = (message) => { const el = $("#toast"); el.textContent = message; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 2400); };

function renderFiles() {
  $("#fileList").innerHTML = state.files.map((file, index) => `
    <div class="file-row">
      <span class="file-type">${escapeHtml(fileExt(file.name))}</span>
      <span class="file-meta"><strong>${escapeHtml(file.name)}</strong><small>${formatBytes(file.size)}</small></span>
      <button class="remove-file" type="button" data-index="${index}" aria-label="Remove ${escapeHtml(file.name)}">×</button>
    </div>`).join("");
}

function addFiles(files) {
  const incoming = [...files];
  const oversized = incoming.filter((file) => file.size > MAX_FILE_SIZE);
  if (oversized.length) toast(`${oversized.length} file${oversized.length > 1 ? "s are" : " is"} over the 250 MB limit`);
  incoming.filter((file) => file.size <= MAX_FILE_SIZE).forEach((file) => {
    if (!state.files.some((existing) => existing.name === file.name && existing.size === file.size)) state.files.push(file);
  });
  renderFiles();
}

const openDb = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

async function storeSubmission(submission) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ id: submission.id, files: state.files });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn("Could not save file blobs; metadata is still available.", error);
  }
}

async function downloadSubmission(id) {
  try {
    const db = await openDb();
    const data = await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!data?.files?.length) return toast("Files are not available in this browser");
    data.files.forEach((file, i) => setTimeout(() => {
      const url = URL.createObjectURL(file);
      const anchor = Object.assign(document.createElement("a"), { href: url, download: file.name });
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, i * 250));
    toast(`Downloading ${data.files.length} file${data.files.length > 1 ? "s" : ""}`);
  } catch { toast("Files are not available in this browser"); }
}

function renderDashboard() {
  const query = $("#searchInput").value.toLowerCase().trim();
  const filter = $("#statusFilter").value;
  const filtered = state.submissions.filter((item) => {
    const haystack = `${item.name} ${item.email} ${item.files.map((file) => file.name).join(" ")}`.toLowerCase();
    return (!query || haystack.includes(query)) && (filter === "all" || item.status === filter);
  });
  $("#totalSubmissions").textContent = state.submissions.length;
  $("#totalFiles").textContent = state.submissions.reduce((sum, item) => sum + item.files.length, 0);
  $("#storageUsed").textContent = formatBytes(state.submissions.reduce((sum, item) => sum + item.files.reduce((n, file) => n + file.size, 0), 0));
  $("#submissionList").innerHTML = filtered.length ? filtered.map((item) => {
    const initials = item.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    const names = item.files.map((file) => file.name).join(", ");
    return `<article class="submission-row">
      <span class="avatar">${escapeHtml(initials)}</span>
      <span class="person"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.email)}</small></span>
      <span class="submission-files"><strong title="${escapeHtml(names)}">${escapeHtml(names)}</strong><small>${item.files.length} file${item.files.length > 1 ? "s" : ""} · ${formatBytes(item.files.reduce((sum, file) => sum + file.size, 0))}</small></span>
      <span class="date-cell">${new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
      <span><button class="status-btn ${item.status}" data-status-id="${item.id}">${item.status}</button><button class="download-btn" data-download-id="${item.id}" aria-label="Download files"><svg viewBox="0 0 20 20"><path d="M10 3v10m0 0 4-4m-4 4L6 9M3 17h14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button></span>
    </article>`;
  }).join("") : `<div class="empty-state"><strong>${state.submissions.length ? "No matching submissions" : "Your drop-off desk is ready"}</strong><span>${state.submissions.length ? "Try a different search or filter." : "New uploads will appear here automatically."}</span></div>`;
}

$("#dropZone").addEventListener("click", () => $("#fileInput").click());
$("#dropZone").addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); $("#fileInput").click(); } });
$("#fileInput").addEventListener("change", (event) => { addFiles(event.target.files); event.target.value = ""; });
["dragenter", "dragover"].forEach((type) => $("#dropZone").addEventListener(type, (event) => { event.preventDefault(); $("#dropZone").classList.add("dragging"); }));
["dragleave", "drop"].forEach((type) => $("#dropZone").addEventListener(type, (event) => { event.preventDefault(); $("#dropZone").classList.remove("dragging"); }));
$("#dropZone").addEventListener("drop", (event) => addFiles(event.dataTransfer.files));
$("#fileList").addEventListener("click", (event) => { const button = event.target.closest("[data-index]"); if (button) { state.files.splice(Number(button.dataset.index), 1); renderFiles(); } });
$("#message").addEventListener("input", (event) => $("#charCount").textContent = event.target.value.length);

$("#uploadForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.files.length) return toast("Add at least one file to continue");
  const button = $("#submitButton"); button.disabled = true; button.firstChild.textContent = "Saving files... ";
  const submission = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name: $("#fullName").value.trim(), email: $("#email").value.trim(), message: $("#message").value.trim(), status: "new", createdAt: new Date().toISOString(),
    files: state.files.map(({ name, size, type }) => ({ name, size, type }))
  };
  await storeSubmission(submission);
  state.submissions.unshift(submission);
  localStorage.setItem("dropdesk-submissions", JSON.stringify(state.submissions));
  $("#successName").textContent = submission.name.split(" ")[0]; $("#successEmail").textContent = submission.email;
  $("#receipt").innerHTML = submission.files.map((file) => `<div class="receipt-row"><svg viewBox="0 0 18 18"><path d="M5 2h5l4 4v10H5zM10 2v4h4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg><span>${escapeHtml(file.name)}</span><small>${formatBytes(file.size)}</small></div>`).join("");
  state.files = []; renderFiles(); event.target.reset(); $("#charCount").textContent = "0"; button.disabled = false; button.firstChild.textContent = "Send files securely "; showView("success");
});

$("#sendMore").addEventListener("click", () => showView("upload"));
$("#adminLink").addEventListener("click", () => { renderDashboard(); showView("admin"); });
$("#backToPortal").addEventListener("click", () => showView("upload"));
$("#searchInput").addEventListener("input", renderDashboard); $("#statusFilter").addEventListener("change", renderDashboard);
$("#submissionList").addEventListener("click", (event) => {
  const statusButton = event.target.closest("[data-status-id]");
  if (statusButton) { const item = state.submissions.find((entry) => entry.id === statusButton.dataset.statusId); item.status = item.status === "new" ? "reviewed" : "new"; localStorage.setItem("dropdesk-submissions", JSON.stringify(state.submissions)); renderDashboard(); }
  const downloadButton = event.target.closest("[data-download-id]"); if (downloadButton) downloadSubmission(downloadButton.dataset.downloadId);
});
