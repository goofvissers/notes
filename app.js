const STORAGE_KEY = "goof-notes-app";

const appShell = document.getElementById("app-shell");
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
const existingTagsList = document.getElementById("existing-tags-list");
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
};

let saveTimer = null;
let isResizingPane = false;

function loadLegacyNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
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

function setLibraryWidth(width) {
  const clampedWidth = Math.max(280, Math.min(620, width));
  appShell.style.setProperty("--sidebar-width", `${clampedWidth}px`);
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

function addTag() {
  const value = tagInput.value.trim().toLowerCase();
  if (!value) {
    return;
  }

  const note = getSelectedNote();
  if (!note || note.tags.includes(value)) {
    tagInput.value = "";
    return;
  }

  note.tags.push(value);
  tagInput.value = "";
  updateSelectedNote({ tags: note.tags });
}

function removeTag(tagToRemove) {
  const note = getSelectedNote();
  if (!note) {
    return;
  }

  updateSelectedNote({
    tags: note.tags.filter((tag) => tag !== tagToRemove),
  });
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

function renderTagSuggestions() {
  existingTagsList.innerHTML = "";
  getAllTags().forEach((tag) => {
    const option = document.createElement("option");
    option.value = tag;
    existingTagsList.append(option);
  });
}

function createNoteRow(note, onClick, onTagClick) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "note-item";
  row.classList.toggle("active", note.id === state.selectedId);

  const title = document.createElement("span");
  title.className = "note-item-title";
  title.textContent = note.title || "Untitled note";
  row.append(title);

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

  row.append(tags);
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
  notesCount.textContent = state.query ? `Filtered | ${countLabel}` : "Library";
  searchLabel.textContent = "Search notes or tags";
  searchInput.placeholder = "Design, ideas, meeting...";

  notesToolbar.classList.remove("is-hidden");
  notesColumns.classList.remove("is-hidden");
  deleteNoteButton.classList.remove("is-hidden");

  sortTitleButton.classList.toggle("is-active", state.sortKey === "title");
  sortTagButton.classList.toggle("is-active", state.sortKey === "tag");
  sortTitleButton.textContent = state.sortKey === "title" ? `Title ${state.sortDirection === "asc" ? "^" : "v"}` : "Title";
  sortTagButton.textContent = state.sortKey === "tag" ? `Tags ${state.sortDirection === "asc" ? "^" : "v"}` : "Tags";

  browserList.innerHTML = "";

  if (!filteredNotes.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No notes match this search yet.";
    browserList.append(empty);
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

  if (!filteredTags.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No tags match this search yet.";
    browserList.append(empty);
    return;
  }

  if (!state.selectedTag || !filteredTags.some((item) => item.tag === state.selectedTag)) {
    state.selectedTag = filteredTags[0]?.tag ?? null;
  }

  if (state.selectedTag) {
    const selectedNotes = state.notes
      .filter((note) => note.tags.includes(state.selectedTag))
      .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));

    const group = tagNoteGroupTemplate.content.firstElementChild.cloneNode(true);
    group.querySelector(".tag-focus-title").textContent = state.selectedTag;
    group.querySelector(".tag-focus-count").textContent = `${selectedNotes.length} note${selectedNotes.length === 1 ? "" : "s"}`;

    const list = group.querySelector(".tag-note-list");
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

    browserList.append(group);
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
    pill.addEventListener("click", (event) => {
      if (event.target.closest(".tag-remove")) {
        return;
      }

      applyTagFilter(tag);
    });
    pill.querySelector(".tag-remove").addEventListener("click", () => removeTag(tag));
    tagList.append(pill);
  });
}

function render() {
  renderTagSuggestions();
  renderBrowser();
  renderEditor();
}

newNoteButton.addEventListener("click", createNote);
deleteNoteButton.addEventListener("click", deleteSelectedNote);
addTagButton.addEventListener("click", addTag);
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

tagInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addTag();
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
});

async function initializeApp() {
  let loadedNotes = [];

  try {
    const persisted = await window.goofNotesApp?.notesStorage?.load();
    loadedNotes = persisted?.notes ?? [];
  } catch (error) {
    console.error("Failed to load persisted notes:", error);
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
