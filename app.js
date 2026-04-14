const STORAGE_KEY = "goof-notes-app";
const MIN_LIBRARY_WIDTH = 280;
const MAX_LIBRARY_WIDTH = 620;
const DEFAULT_LIBRARY_WIDTH = 360;
const PREVIEW_THRESHOLD = 420;

const appShell = document.getElementById("app-shell");
const browserPane = document.querySelector(".browser-pane");
const browserTitle = document.getElementById("browser-title");
const browserCount = document.getElementById("browser-count");
const notesCount = document.getElementById("notes-count");
const searchInput = document.getElementById("search-input");
const searchLabel = document.getElementById("search-label");
const notesToolbar = document.getElementById("notes-toolbar");
const notesColumns = document.getElementById("notes-columns");
const browserList = document.getElementById("browser-list");
const noteStatus = document.getElementById("note-status");
const updatedAt = document.getElementById("updated-at");
const noteTitle = document.getElementById("note-title");
const noteBody = document.getElementById("note-body");
const tagInput = document.getElementById("tag-input");
const tagSuggestions = document.getElementById("tag-suggestions");
const tagSuggestionList = document.getElementById("tag-suggestion-list");
const tagList = document.getElementById("tag-list");
const newNoteButton = document.getElementById("new-note-button");
const deleteNoteButton = document.getElementById("delete-note-button");
const addTagButton = document.getElementById("add-tag-button");
const openDataFolderButton = document.getElementById("open-data-folder-inline");
const sortTitleButton = document.getElementById("sort-title-button");
const sortTagButton = document.getElementById("sort-tag-button");
const modeNotesButton = document.getElementById("mode-notes-button");
const modeTagsButton = document.getElementById("mode-tags-button");
const paneResizer = document.getElementById("pane-resizer");
const tagNoteGroupTemplate = document.getElementById("tag-note-group-template");
const tagPillTemplate = document.getElementById("tag-pill-template");

const defaultNotes = [
  {
    id: crypto.randomUUID(),
    title: "Goof Notes direction",
    body:
      "Keep the interface calm and premium. Notes should feel quick to capture and easy to scan at a glance.",
    tags: ["ux", "priority"],
    updatedAt: new Date().toISOString(),
  },
];

let state = {
  notes: [],
  selectedId: null,
  browserMode: "notes",
  selectedTag: null,
  query: "",
  saveMessage: "Saved on this device",
  sortKey: "title",
  sortDirection: "asc",
  paneWidth: DEFAULT_LIBRARY_WIDTH,
  tagSuggestions: [],
  activeSuggestionIndex: -1,
};

let saveTimer = null;
let settingsTimer = null;
let isResizingPane = false;

function loadLegacyNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function clampPaneWidth(width) {
  if (!Number.isFinite(width)) {
    return DEFAULT_LIBRARY_WIDTH;
  }

  return Math.max(MIN_LIBRARY_WIDTH, Math.min(MAX_LIBRARY_WIDTH, width));
}

function setLibraryWidth(width) {
  const clampedWidth = clampPaneWidth(width);
  state.paneWidth = clampedWidth;
  appShell.style.setProperty("--sidebar-width", `${clampedWidth}px`);
  browserPane.classList.toggle("show-preview", clampedWidth >= PREVIEW_THRESHOLD);
}

function scheduleSettingsSave() {
  clearTimeout(settingsTimer);
  settingsTimer = setTimeout(async () => {
    try {
      await window.goofNotesApp?.settings?.save({ paneWidth: state.paneWidth });
    } catch (error) {
      console.error("Failed to save UI settings:", error);
    }
  }, 180);
}

async function saveNotes() {
  if (!window.goofNotesApp?.notesStorage) {
    return;
  }

  try {
    await window.goofNotesApp.notesStorage.save(state.notes);
    state.saveMessage = "Saved on this device";
  } catch (error) {
    console.error("Failed to save notes:", error);
    state.saveMessage = "Save failed";
  }

  renderEditor();
}

async function openDataFolder() {
  if (!window.goofNotesApp?.notesStorage?.openDataFolder) {
    return;
  }

  try {
    const result = await window.goofNotesApp.notesStorage.openDataFolder();
    state.saveMessage = result?.ok ? "Opened data folder" : "Could not open data folder";
  } catch (error) {
    console.error("Failed to open data folder:", error);
    state.saveMessage = "Could not open data folder";
  }

  renderEditor();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  state.saveMessage = "Saving...";
  renderEditor();
  saveTimer = setTimeout(() => {
    saveNotes();
  }, 250);
}

function getAllTags() {
  return [...new Set(state.notes.flatMap((note) => note.tags).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function getTagSummary() {
  return getAllTags().map((tag) => ({
    tag,
    count: state.notes.filter((note) => note.tags.includes(tag)).length,
  }));
}

function getSelectedNote() {
  return state.notes.find((note) => note.id === state.selectedId) ?? null;
}

function getFilteredNotes() {
  const query = state.query.trim().toLowerCase();
  const filteredNotes = !query
    ? [...state.notes]
    : state.notes.filter((note) => {
        const haystack = [note.title, note.body, note.tags.join(" ")].join(" ").toLowerCase();
        return haystack.includes(query);
      });

  filteredNotes.sort((left, right) => {
    const leftValue =
      state.sortKey === "tag" ? (left.tags[0] ?? "").toLowerCase() : (left.title ?? "").toLowerCase();
    const rightValue =
      state.sortKey === "tag" ? (right.tags[0] ?? "").toLowerCase() : (right.title ?? "").toLowerCase();
    const compare = leftValue.localeCompare(rightValue);
    return state.sortDirection === "asc" ? compare : compare * -1;
  });

  return filteredNotes;
}

function getFilteredTags() {
  const query = state.query.trim().toLowerCase();
  return getTagSummary().filter((item) => !query || item.tag.includes(query));
}

function getMatchingTagSuggestions(query) {
  const normalizedQuery = query.trim().toLowerCase();
  const selectedNote = getSelectedNote();
  const usedTags = new Set(selectedNote?.tags ?? []);

  if (!normalizedQuery) {
    return getTagSummary().filter(({ tag }) => !usedTags.has(tag)).slice(0, 6);
  }

  return getTagSummary()
    .filter(({ tag }) => tag.includes(normalizedQuery) && !usedTags.has(tag))
    .slice(0, 6);
}

function showTagSuggestions() {
  state.tagSuggestions = getMatchingTagSuggestions(tagInput.value);
  state.activeSuggestionIndex = state.tagSuggestions.length ? 0 : -1;
  renderTagSuggestions();
}

function hideTagSuggestions() {
  state.tagSuggestions = [];
  state.activeSuggestionIndex = -1;
  renderTagSuggestions();
}

function renderTagSuggestions() {
  tagSuggestionList.innerHTML = "";

  if (!state.tagSuggestions.length) {
    tagSuggestions.classList.add("is-hidden");
    tagInput.setAttribute("aria-expanded", "false");
    return;
  }

  state.tagSuggestions.forEach(({ tag, count }, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "tag-suggestion-item";
    item.classList.toggle("is-active", index === state.activeSuggestionIndex);
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", index === state.activeSuggestionIndex ? "true" : "false");

    const label = document.createElement("span");
    label.textContent = tag;

    const meta = document.createElement("span");
    meta.className = "tag-suggestion-meta";
    meta.textContent = `${count} note${count === 1 ? "" : "s"}`;

    item.append(label, meta);
    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      addTag(tag);
    });

    tagSuggestionList.append(item);
  });

  tagSuggestions.classList.remove("is-hidden");
  tagInput.setAttribute("aria-expanded", "true");
}

function setBrowserMode(mode) {
  state.browserMode = mode;
  state.query = "";
  searchInput.value = "";

  if (mode === "tags") {
    state.selectedTag ??= getAllTags()[0] ?? null;
  }

  render();
}

function applyTagFilter(tag) {
  state.browserMode = "tags";
  state.selectedTag = tag;
  state.query = "";
  searchInput.value = "";
  render();
}

function setSort(key) {
  if (state.sortKey === key) {
    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  } else {
    state.sortKey = key;
    state.sortDirection = "asc";
  }

  renderBrowser();
}

function createNote() {
  const note = {
    id: crypto.randomUUID(),
    title: "Untitled note",
    body: "",
    tags: [],
    updatedAt: new Date().toISOString(),
  };

  state.notes.unshift(note);
  state.selectedId = note.id;
  state.browserMode = "notes";
  persistAndRender();
  noteTitle.focus();
  noteTitle.select();
}

function deleteSelectedNote() {
  if (!state.selectedId) {
    return;
  }

  state.notes = state.notes.filter((note) => note.id !== state.selectedId);
  state.selectedId = state.notes[0]?.id ?? null;

  if (!state.notes.length) {
    createNote();
    return;
  }

  persistAndRender();
}

function updateSelectedNote(changes) {
  const note = getSelectedNote();
  if (!note) {
    return;
  }

  Object.assign(note, changes, { updatedAt: new Date().toISOString() });
  persistAndRender();
}

function addTag(forcedValue) {
  const value = (forcedValue ?? tagInput.value).trim().toLowerCase();
  if (!value) {
    return;
  }

  const note = getSelectedNote();
  if (!note) {
    return;
  }

  if (note.tags.includes(value)) {
    tagInput.value = "";
    hideTagSuggestions();
    return;
  }

  note.tags.push(value);
  tagInput.value = "";
  hideTagSuggestions();
  updateSelectedNote({ tags: [...note.tags].sort((a, b) => a.localeCompare(b)) });
}

function removeTag(tagToRemove) {
  const note = getSelectedNote();
  if (!note) {
    return;
  }

  updateSelectedNote({
    tags: note.tags.filter((tag) => tag !== tagToRemove),
  });

  if (state.selectedTag === tagToRemove && !getAllTags().includes(tagToRemove)) {
    state.selectedTag = getAllTags()[0] ?? null;
  }
}

function persistAndRender() {
  state.notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  scheduleSave();
  render();
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function createEmptyState(title, detail) {
  const empty = document.createElement("div");
  empty.className = "empty-state";

  const heading = document.createElement("strong");
  heading.textContent = title;

  const copy = document.createElement("span");
  copy.textContent = detail;

  empty.append(heading, copy);
  return empty;
}

function getNotePreview(note) {
  const preview = note.body.trim().replace(/\s+/g, " ");
  return preview || "No content yet";
}

function createNoteRow(note, onClick, onTagClick) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "note-item";
  row.classList.toggle("active", note.id === state.selectedId);

  const main = document.createElement("div");
  main.className = "note-item-main";

  const title = document.createElement("span");
  title.className = "note-item-title";
  title.textContent = note.title || "Untitled note";

  const preview = document.createElement("span");
  preview.className = "note-item-preview";
  preview.textContent = getNotePreview(note);

  main.append(title, preview);

  const tags = document.createElement("div");
  tags.className = "note-item-tags";

  if (!note.tags.length) {
    const emptyTag = document.createElement("span");
    emptyTag.className = "mini-tag";
    emptyTag.textContent = "No tags";
    tags.append(emptyTag);
  }

  note.tags.forEach((tag) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "mini-tag";
    pill.textContent = tag;
    pill.addEventListener("click", (event) => {
      event.stopPropagation();
      onTagClick(tag);
    });
    tags.append(pill);
  });

  row.append(main, tags);
  row.addEventListener("click", onClick);
  return row;
}

function createTagRow(tag, count, onClick) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "tag-browser-item";
  row.classList.toggle("active", tag === state.selectedTag);

  const wrap = document.createElement("div");
  wrap.className = "tag-browser-row";

  const name = document.createElement("strong");
  name.className = "tag-browser-name";
  name.textContent = tag;

  const countLabel = document.createElement("span");
  countLabel.className = "tag-browser-count";
  countLabel.textContent = `${count} note${count === 1 ? "" : "s"}`;

  wrap.append(name, countLabel);
  row.append(wrap);
  row.addEventListener("click", onClick);
  return row;
}

function renderNotesMode() {
  const filteredNotes = getFilteredNotes();
  const countLabel = `${filteredNotes.length} note${filteredNotes.length === 1 ? "" : "s"}`;

  browserTitle.textContent = "Notes";
  browserCount.textContent = countLabel;
  notesCount.textContent = state.query ? `Results | ${countLabel}` : "Library";
  searchLabel.textContent = "Search notes or tags";
  searchInput.placeholder = "Design, ideas, meeting...";

  notesToolbar.classList.remove("is-hidden");
  notesColumns.classList.remove("is-hidden");
  deleteNoteButton.classList.remove("is-hidden");

  sortTitleButton.classList.toggle("is-active", state.sortKey === "title");
  sortTagButton.classList.toggle("is-active", state.sortKey === "tag");
  sortTitleButton.textContent =
    state.sortKey === "title" ? `Title ${state.sortDirection === "asc" ? "^" : "v"}` : "Title";
  sortTagButton.textContent =
    state.sortKey === "tag" ? `Tags ${state.sortDirection === "asc" ? "^" : "v"}` : "Tags";

  browserList.innerHTML = "";

  if (!state.notes.length) {
    browserList.append(
      createEmptyState("No notes yet", "Create your first note to start building your library."),
    );
    return;
  }

  if (!filteredNotes.length) {
    browserList.append(
      createEmptyState("No matching notes", "Try a different search or clear the current filter."),
    );
    return;
  }

  filteredNotes.forEach((note) => {
    const item = createNoteRow(
      note,
      () => {
        state.selectedId = note.id;
        render();
      },
      (tag) => applyTagFilter(tag),
    );
    browserList.append(item);
  });
}

function renderSelectedTagGroup() {
  const selectedNotes = state.notes
    .filter((note) => note.tags.includes(state.selectedTag))
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));

  const group = tagNoteGroupTemplate.content.firstElementChild.cloneNode(true);
  group.querySelector(".tag-focus-title").textContent = state.selectedTag;
  group.querySelector(".tag-focus-count").textContent = `${selectedNotes.length} note${
    selectedNotes.length === 1 ? "" : "s"
  }`;

  const headerBody = group.querySelector(".tag-note-header > div");
  headerBody.className = "tag-focus-copy";

  const badge = document.createElement("span");
  badge.className = "tag-focus-badge";
  badge.textContent = "Selected tag";
  headerBody.append(badge);

  const list = group.querySelector(".tag-note-list");

  if (!selectedNotes.length) {
    list.append(
      createEmptyState(
        "No notes use this tag yet",
        "Select a different tag or add this tag to a note on the right.",
      ),
    );
    return group;
  }

  selectedNotes.forEach((note) => {
    const item = createNoteRow(
      note,
      () => {
        state.selectedId = note.id;
        render();
      },
      (tag) => {
        state.selectedTag = tag;
        renderBrowser();
      },
    );
    list.append(item);
  });

  return group;
}

function renderTagsMode() {
  const filteredTags = getFilteredTags();
  const totalTags = getAllTags().length;

  browserTitle.textContent = "Tags";
  browserCount.textContent = `${totalTags} tag${totalTags === 1 ? "" : "s"}`;
  notesCount.textContent = state.selectedTag ? `Selected | ${state.selectedTag}` : "Tags";
  searchLabel.textContent = "Find tags";
  searchInput.placeholder = "pbi, sql, ideas...";

  notesToolbar.classList.remove("is-hidden");
  notesColumns.classList.add("is-hidden");
  deleteNoteButton.classList.add("is-hidden");
  browserList.innerHTML = "";

  if (!totalTags) {
    browserList.append(
      createEmptyState("No tags yet", "Add tags to your notes to organize them here."),
    );
    return;
  }

  if (!filteredTags.length) {
    browserList.append(
      createEmptyState("No matching tags", "Try a different search or clear the current filter."),
    );
    return;
  }

  if (!state.selectedTag || !getAllTags().includes(state.selectedTag)) {
    state.selectedTag = filteredTags[0]?.tag ?? null;
  }

  if (state.selectedTag) {
    browserList.append(renderSelectedTagGroup());

    const divider = document.createElement("div");
    divider.className = "tag-directory-divider";
    divider.textContent = "All tags";
    browserList.append(divider);
  }

  filteredTags.forEach(({ tag, count }) => {
    const item = createTagRow(tag, count, () => {
      state.selectedTag = tag;
      renderBrowser();
    });
    browserList.append(item);
  });
}

function renderBrowser() {
  modeNotesButton.classList.toggle("is-active", state.browserMode === "notes");
  modeTagsButton.classList.toggle("is-active", state.browserMode === "tags");

  if (state.browserMode === "notes") {
    renderNotesMode();
  } else {
    renderTagsMode();
  }
}

function renderEditor() {
  const note = getSelectedNote();

  if (!note) {
    noteStatus.textContent = "No note selected";
    updatedAt.textContent = state.saveMessage;
    noteTitle.value = "";
    noteBody.value = "";
    tagList.innerHTML = "";
    return;
  }

  noteStatus.textContent = note.title || "Untitled note";
  updatedAt.textContent = `${state.saveMessage} | Updated ${formatDate(note.updatedAt)}`;
  noteTitle.value = note.title;
  noteBody.value = note.body;
  tagList.innerHTML = "";

  note.tags.forEach((tag) => {
    const pill = tagPillTemplate.content.firstElementChild.cloneNode(true);
    pill.querySelector(".tag-label").textContent = tag;
    pill.classList.add("filterable");
    pill.setAttribute("tabindex", "0");
    pill.addEventListener("click", (event) => {
      if (event.target.closest(".tag-remove")) {
        return;
      }

      applyTagFilter(tag);
    });
    pill.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        applyTagFilter(tag);
      }
    });
    pill.querySelector(".tag-remove").addEventListener("click", () => removeTag(tag));
    tagList.append(pill);
  });
}

function render() {
  setLibraryWidth(state.paneWidth);
  renderBrowser();
  renderEditor();
  renderTagSuggestions();
}

function clearSearchAndSuggestions() {
  state.query = "";
  searchInput.value = "";
  hideTagSuggestions();
  renderBrowser();
}

function focusTagInput() {
  tagInput.focus();
  tagInput.select();
  showTagSuggestions();
}

newNoteButton.addEventListener("click", createNote);
deleteNoteButton.addEventListener("click", deleteSelectedNote);
addTagButton.addEventListener("click", () => addTag());
openDataFolderButton?.addEventListener("click", openDataFolder);
sortTitleButton.addEventListener("click", () => setSort("title"));
sortTagButton.addEventListener("click", () => setSort("tag"));
modeNotesButton.addEventListener("click", () => setBrowserMode("notes"));
modeTagsButton.addEventListener("click", () => setBrowserMode("tags"));

noteTitle.addEventListener("input", (event) => {
  updateSelectedNote({ title: event.target.value });
});

noteBody.addEventListener("input", (event) => {
  updateSelectedNote({ body: event.target.value });
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderBrowser();
});

tagInput.addEventListener("focus", showTagSuggestions);
tagInput.addEventListener("input", showTagSuggestions);
tagInput.addEventListener("blur", () => {
  setTimeout(() => {
    if (!tagSuggestions.contains(document.activeElement)) {
      hideTagSuggestions();
    }
  }, 80);
});

tagInput.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" && state.tagSuggestions.length) {
    event.preventDefault();
    state.activeSuggestionIndex = (state.activeSuggestionIndex + 1) % state.tagSuggestions.length;
    renderTagSuggestions();
    return;
  }

  if (event.key === "ArrowUp" && state.tagSuggestions.length) {
    event.preventDefault();
    state.activeSuggestionIndex =
      (state.activeSuggestionIndex - 1 + state.tagSuggestions.length) % state.tagSuggestions.length;
    renderTagSuggestions();
    return;
  }

  if (event.key === "Escape") {
    hideTagSuggestions();
    tagInput.blur();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const activeSuggestion = state.tagSuggestions[state.activeSuggestionIndex];
    addTag(activeSuggestion?.tag ?? undefined);
  }
});

document.addEventListener("keydown", (event) => {
  const isModifier = event.ctrlKey || event.metaKey;

  if (isModifier && event.key.toLowerCase() === "n") {
    event.preventDefault();
    createNote();
    return;
  }

  if (isModifier && event.key.toLowerCase() === "f") {
    event.preventDefault();
    searchInput.focus();
    searchInput.select();
    return;
  }

  if (isModifier && event.shiftKey && event.key.toLowerCase() === "t") {
    event.preventDefault();
    focusTagInput();
    return;
  }

  if (event.key === "Escape") {
    if (document.activeElement === tagInput && state.tagSuggestions.length) {
      hideTagSuggestions();
      return;
    }

    clearSearchAndSuggestions();
  }
});

paneResizer?.addEventListener("pointerdown", (event) => {
  isResizingPane = true;
  paneResizer.classList.add("is-dragging");
  paneResizer.setPointerCapture(event.pointerId);
});

paneResizer?.addEventListener("pointermove", (event) => {
  if (!isResizingPane) {
    return;
  }

  setLibraryWidth(event.clientX - 86);
});

paneResizer?.addEventListener("pointerup", (event) => {
  isResizingPane = false;
  paneResizer.classList.remove("is-dragging");
  paneResizer.releasePointerCapture(event.pointerId);
  scheduleSettingsSave();
});

window.addEventListener("resize", () => {
  setLibraryWidth(state.paneWidth);
});

async function initializeApp() {
  let loadedNotes = [];

  try {
    const persisted = await window.goofNotesApp?.notesStorage?.load();
    loadedNotes = persisted?.notes ?? [];
  } catch (error) {
    console.error("Failed to load persisted notes:", error);
  }

  try {
    const settings = await window.goofNotesApp?.settings?.load();
    setLibraryWidth(settings?.paneWidth ?? DEFAULT_LIBRARY_WIDTH);
  } catch (error) {
    console.error("Failed to load UI settings:", error);
    setLibraryWidth(DEFAULT_LIBRARY_WIDTH);
  }

  if (!loadedNotes.length) {
    const legacyNotes = loadLegacyNotes();
    if (legacyNotes.length) {
      loadedNotes = legacyNotes;
      state.notes = legacyNotes;
      state.selectedId = legacyNotes[0]?.id ?? null;
      state.saveMessage = "Migrating existing notes...";
      render();
      await saveNotes();
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  state.notes = loadedNotes.length ? loadedNotes : defaultNotes;
  state.selectedId = state.notes[0]?.id ?? null;
  state.selectedTag = getAllTags()[0] ?? null;

  if (!loadedNotes.length) {
    await saveNotes();
  }

  render();
}

initializeApp();
