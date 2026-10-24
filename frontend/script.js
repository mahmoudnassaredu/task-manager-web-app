/* ==========================================================
   TaskFlow - script.js
   Plain JavaScript, no libraries.

   How this file is organised:
   1. Settings
   2. State and element references
   3. API helpers (everything that talks to the backend)
   4. Actions (load, add, complete, delete)
   5. Rendering (draw the page from the state)
   6. UI helpers (toast, modal, mobile menu, filters)
   7. Start-up
   ========================================================== */

"use strict";

/* ---------- 1. Settings ---------- */

// Relative path: Nginx will forward /api/... to the Node.js backend.
// Never put http://localhost:3000 here.
const API_URL = "/api/tasks";

// Your API has no delete endpoint yet, so delete is switched off.
// After you add DELETE /api/tasks/:id to the backend, change this to true.
const DELETE_ENABLED = false;

/* ---------- 2. State and element references ---------- */

const state = {
  tasks: [],            // the task list we got from the API
  filter: "all",        // "all" | "pending" | "completed"
  status: "loading",    // "loading" | "error" | "ready"
  errorMessage: "",
  busyIds: new Set(),   // ids of tasks that are being updated right now
};

const $ = (id) => document.getElementById(id);

const el = {
  sidebar: $("sidebar"),
  scrim: $("scrim"),
  menuBtn: $("menu-btn"),
  navItems: document.querySelectorAll(".nav-item"),
  apiDot: $("api-dot"),
  apiStatus: $("api-status"),

  greeting: $("greeting"),
  subtitle: $("subtitle"),
  openModal: $("open-modal"),

  statTotal: $("stat-total"),
  statCompleted: $("stat-completed"),
  statPending: $("stat-pending"),
  countAll: $("count-all"),
  countPending: $("count-pending"),
  countCompleted: $("count-completed"),

  progressTrack: $("progress-track"),
  progressFill: $("progress-fill"),
  progressPercent: $("progress-percent"),
  progressCaption: $("progress-caption"),

  listTitle: $("list-title"),
  listCount: $("list-count"),
  deleteNote: $("delete-note"),
  stateLoading: $("state-loading"),
  stateError: $("state-error"),
  errorMessage: $("error-message"),
  retryBtn: $("retry-btn"),
  stateEmpty: $("state-empty"),
  emptyTitle: $("empty-title"),
  emptyText: $("empty-text"),
  emptyAddBtn: $("empty-add-btn"),
  taskList: $("task-list"),

  modal: $("task-modal"),
  form: $("task-form"),
  titleInput: $("task-title"),
  formError: $("form-error"),
  submitTask: $("submit-task"),
  closeModal: $("close-modal"),
  cancelModal: $("cancel-modal"),

  toast: $("toast"),
};

/* ---------- 3. API helpers ---------- */

/**
 * Turn whatever the API returns into a task object the UI understands.
 * Your database might call the "done" column completed, done, or status,
 * so this accepts all three. If yours is different, change it here.
 */
function normalizeTask(raw) {
  const completed =
    raw.completed ?? raw.done ?? raw.is_completed ?? raw.status === "completed";

  return {
    id: raw.id,
    title: String(raw.title ?? "Untitled task"),
    completed: Boolean(completed),
  };
}

/** A small wrapper around fetch() that always uses JSON and throws readable errors. */
async function apiRequest(url, options = {}) {
  const headers = { Accept: "application/json" };
  if (options.body) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (err) {
    throw new Error("Can't reach the server. Check that your containers are running.");
  }

  if (!response.ok) {
    let message = `The server answered with an error (${response.status}).`;
    try {
      const data = await response.json();
      if (data && (data.error || data.message)) message = data.error || data.message;
    } catch (err) {
      /* the error body wasn't JSON, keep the default message */
    }
    throw new Error(message);
  }

  if (response.status === 204) return null; // "No Content"

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (err) {
    // Usually means Nginx returned an HTML page instead of reaching the API.
    throw new Error("The server didn't return JSON. Check the /api proxy in your Nginx config.");
  }
}

/* ---------- 4. Actions ---------- */

/** GET /api/tasks. Pass { silent: true } to refresh without the loading skeleton. */
async function loadTasks({ silent = false } = {}) {
  if (!silent) {
    state.status = "loading";
    render();
  }

  try {
    const data = await apiRequest(API_URL);
    const list = Array.isArray(data) ? data : (data && data.tasks) || [];
    state.tasks = list.map(normalizeTask);
    state.status = "ready";
    setApiStatus(true);
  } catch (err) {
    setApiStatus(false);
    if (silent && state.status === "ready") {
      showToast(err.message, "error"); // keep showing the tasks we already have
    } else {
      state.status = "error";
      state.errorMessage = err.message;
    }
  }

  render();
}

/** POST /api/tasks with {"title": "..."} */
async function addTask(title) {
  await apiRequest(API_URL, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  await loadTasks({ silent: true });
}

/** PATCH /api/tasks/:id marks the task as completed. */
async function completeTask(task) {
  state.busyIds.add(task.id);
  render();

  try {
    await apiRequest(`${API_URL}/${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ completed: true }),
    });

    // Update the screen right away, then sync with the server.
    task.completed = true;
    state.busyIds.delete(task.id);
    render();
    showToast("Task completed", "success");
    loadTasks({ silent: true });
  } catch (err) {
    state.busyIds.delete(task.id);
    render();
    showToast(err.message, "error");
  }
}

/** DELETE /api/tasks/:id (only runs when DELETE_ENABLED is true). */
async function deleteTask(task) {
  if (!DELETE_ENABLED) return;

  state.busyIds.add(task.id);
  render();

  try {
    await apiRequest(`${API_URL}/${encodeURIComponent(task.id)}`, { method: "DELETE" });
    state.tasks = state.tasks.filter((t) => t.id !== task.id);
    state.busyIds.delete(task.id);
    render();
    showToast("Task deleted", "success");
  } catch (err) {
    state.busyIds.delete(task.id);
    render();
    showToast(err.message, "error");
  }
}

/* ---------- 5. Rendering ---------- */

const FILTER_TITLES = {
  all: "All tasks",
  pending: "Pending tasks",
  completed: "Completed tasks",
};

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Redraw everything from the current state. */
function render() {
  renderStats();
  renderList();
}

function renderStats() {
  const total = state.tasks.length;
  const completed = state.tasks.filter((t) => t.completed).length;
  const pending = total - completed;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  el.statTotal.textContent = total;
  el.statCompleted.textContent = completed;
  el.statPending.textContent = pending;
  el.countAll.textContent = total;
  el.countPending.textContent = pending;
  el.countCompleted.textContent = completed;

  el.progressPercent.textContent = `${percent}%`;
  el.progressFill.style.width = `${percent}%`;
  el.progressTrack.setAttribute("aria-valuenow", percent);

  if (total === 0) {
    el.progressCaption.textContent = "No tasks yet. Add one to start tracking progress.";
  } else {
    el.progressCaption.textContent = `${completed} of ${plural(total, "task")} completed`;
  }

  if (state.status === "loading") {
    el.subtitle.textContent = "Loading your tasks…";
  } else if (state.status === "error") {
    el.subtitle.textContent = "We couldn't reach your tasks.";
  } else if (total === 0) {
    el.subtitle.textContent = "Add your first task to get started.";
  } else if (pending === 0) {
    el.subtitle.textContent = "Everything is done. Nice work!";
  } else {
    el.subtitle.textContent = `You have ${plural(pending, "task")} left to finish.`;
  }
}

function getVisibleTasks() {
  if (state.filter === "pending") return state.tasks.filter((t) => !t.completed);
  if (state.filter === "completed") return state.tasks.filter((t) => t.completed);
  return state.tasks;
}

function renderList() {
  const visible = getVisibleTasks();

  el.listTitle.textContent = FILTER_TITLES[state.filter];
  el.listCount.textContent =
    state.status === "ready" ? plural(visible.length, "task") : "";
  el.deleteNote.hidden = DELETE_ENABLED;

  // Show exactly one of: loading, error, empty, list
  el.stateLoading.hidden = state.status !== "loading";
  el.stateError.hidden = state.status !== "error";
  el.errorMessage.textContent = state.errorMessage;

  const showEmpty = state.status === "ready" && visible.length === 0;
  el.stateEmpty.hidden = !showEmpty;
  el.taskList.hidden = !(state.status === "ready" && visible.length > 0);

  if (showEmpty) {
    if (state.tasks.length === 0) {
      el.emptyTitle.textContent = "No tasks yet";
      el.emptyText.textContent = "Add your first task to get started.";
      el.emptyAddBtn.hidden = false;
    } else if (state.filter === "pending") {
      el.emptyTitle.textContent = "Nothing pending";
      el.emptyText.textContent = "You're all caught up.";
      el.emptyAddBtn.hidden = false;
    } else {
      el.emptyTitle.textContent = "No completed tasks yet";
      el.emptyText.textContent = "Tick a task off and it will show up here.";
      el.emptyAddBtn.hidden = true;
    }
  }

  // Rebuild the <ul>
  el.taskList.replaceChildren(...visible.map(createTaskRow));
}

/**
 * Build one <li> for a task.
 * Using textContent (not innerHTML) means a task title can never inject HTML.
 */
function createTaskRow(task) {
  const busy = state.busyIds.has(task.id);

  const li = document.createElement("li");
  li.className = "task";
  if (task.completed) li.classList.add("is-done");
  if (busy) li.classList.add("is-busy");

  // Checkbox: completing is one-way because the API has no "undo" endpoint
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "check";
  checkbox.checked = task.completed || busy;
  checkbox.disabled = task.completed || busy;
  checkbox.setAttribute(
    "aria-label",
    task.completed ? `${task.title} (completed)` : `Mark "${task.title}" as completed`
  );
  checkbox.addEventListener("change", () => completeTask(task));

  // Title + status badge
  const body = document.createElement("div");
  body.className = "task-body";

  const title = document.createElement("span");
  title.className = "task-title";
  title.textContent = task.title;

  const badge = document.createElement("span");
  badge.className = `badge ${task.completed ? "badge--done" : "badge--pending"}`;
  badge.textContent = task.completed ? "Completed" : "Pending";

  body.append(title, badge);

  // Delete button
  const del = document.createElement("button");
  del.type = "button";
  del.className = "icon-btn delete-btn";
  del.disabled = !DELETE_ENABLED || busy;
  del.setAttribute("aria-label", `Delete "${task.title}"`);
  del.title = DELETE_ENABLED
    ? "Delete task"
    : "Delete isn't available yet: the API needs a DELETE endpoint";
  del.innerHTML =
    '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>';
  del.addEventListener("click", () => deleteTask(task));

  li.append(checkbox, body, del);
  return li;
}

/* ---------- 6. UI helpers ---------- */

function setApiStatus(online) {
  el.apiDot.classList.toggle("is-online", online);
  el.apiDot.classList.toggle("is-offline", !online);
  el.apiStatus.textContent = online ? "API connected" : "API unreachable";
}

let toastTimer;
function showToast(message, type = "success") {
  el.toast.textContent = message;
  el.toast.className = `toast is-${type}`;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.toast.hidden = true), 3500);
}

/* Modal */
function openTaskModal() {
  el.form.reset();
  el.formError.hidden = true;
  el.submitTask.disabled = false;
  el.submitTask.textContent = "Add task";
  closeMenu();
  el.modal.showModal();
  el.titleInput.focus();
}

function closeTaskModal() {
  el.modal.close();
}

async function handleFormSubmit(event) {
  event.preventDefault();

  const title = el.titleInput.value.trim();
  if (!title) {
    el.formError.textContent = "Enter a title for your task.";
    el.formError.hidden = false;
    el.titleInput.focus();
    return;
  }

  el.formError.hidden = true;
  el.submitTask.disabled = true;
  el.submitTask.textContent = "Adding…";

  try {
    await addTask(title);
    closeTaskModal();
    showToast("Task added", "success");
  } catch (err) {
    el.formError.textContent = err.message;
    el.formError.hidden = false;
    el.submitTask.disabled = false;
    el.submitTask.textContent = "Add task";
  }
}

/* Sidebar filters */
function setFilter(filter) {
  state.filter = filter;
  el.navItems.forEach((item) => {
    const active = item.dataset.filter === filter;
    item.classList.toggle("is-active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  renderList();
  closeMenu();
}

/* Mobile menu */
function openMenu() {
  el.sidebar.classList.add("is-open");
  el.scrim.hidden = false;
  el.menuBtn.setAttribute("aria-expanded", "true");
}

function closeMenu() {
  el.sidebar.classList.remove("is-open");
  el.scrim.hidden = true;
  el.menuBtn.setAttribute("aria-expanded", "false");
}

/* ---------- 7. Start-up ---------- */

function init() {
  el.greeting.textContent = `${getGreeting()}, welcome back`;

  el.navItems.forEach((item) =>
    item.addEventListener("click", () => setFilter(item.dataset.filter))
  );

  el.openModal.addEventListener("click", openTaskModal);
  el.emptyAddBtn.addEventListener("click", openTaskModal);
  el.closeModal.addEventListener("click", closeTaskModal);
  el.cancelModal.addEventListener("click", closeTaskModal);
  el.form.addEventListener("submit", handleFormSubmit);

  // Clicking the dark backdrop (outside the card) closes the modal
  el.modal.addEventListener("click", (event) => {
    if (event.target === el.modal) closeTaskModal();
  });

  el.retryBtn.addEventListener("click", () => loadTasks());

  el.menuBtn.addEventListener("click", openMenu);
  el.scrim.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  render();
  loadTasks(); // fetch existing tasks from GET /api/tasks when the page loads
}

init();