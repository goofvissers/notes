const STORAGE_KEY = "lumen-notes-app";

const notesList = document.getElementById("notes-list");
const notesCount = document.getElementById("notes-count");
const noteStatus = document.getElementById("note-status");
const updatedAt = document.getElementById("updated-at");
const noteTitle = document.getElementById("note-title");
const noteBody = document.getElementById("note-body");
const searchInput = document.getElementById("search-input");
const tagInput = document.getElementById("tag-input");
const tagList = document.getElementById("tag-list");
const newNoteButton = document.getElementById("new-note-button");
const deleteNoteButton = document.getElementById("delete-note-button");
const addTagButton = document.getElementById("add-tag-button");
const noteItemTemplate = document.getElementById("note-item-template");
const tagPillTemplate = document.getElementById("tag-pill-template");

const defaultNotes = [
  {
    id: crypto.randomUUID(),
    title: "Product direction",
    body:
      "Keep the interface calm and premium. Notes should feel quick to capture and easy to scan at a glance.",
    tags: ["ux", "priority"],
    updatedAt: new Date().toISOString(),
  },
];

let state = {
  notes: loadNotes(),
  selectedId: null,
  query: "",
};

if (!state.notes.length) {
  state.notes = defaultNotes;
}

state.selectedId = state.notes[0]?.id ?? null;

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
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

function getSelectedNote() {
  return state.notes.find((note) => note.id === state.selectedId) ?? null;
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
  saveNotes();
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
  if (!query) {
    return state.notes;
  }

  return state.notes.filter((note) => {
    const haystack = [note.title, note.body, note.tags.join(" ")].join(" ").toLowerCase();
    return haystack.includes(query);
  });
}

function renderNotesList() {
  const filteredNotes = getFilteredNotes();
  notesList.innerHTML = "";
  notesCount.textContent = `${filteredNotes.length} note${filteredNotes.length === 1 ? "" : "s"}`;

  if (!filteredNotes.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No notes match this search yet.";
    notesList.append(empty);
    return;
  }

  filteredNotes.forEach((note) => {
    const item = noteItemTemplate.content.firstElementChild.cloneNode(true);
    item.classList.toggle("active", note.id === state.selectedId);
    item.querySelector(".note-item-title").textContent = note.title || "Untitled note";
    item.querySelector(".note-item-date").textContent = formatDate(note.updatedAt);
    item.querySelector(".note-item-preview").textContent =
      note.body.trim() || "Start writing to preview this note.";

    const tagsContainer = item.querySelector(".note-item-tags");
    note.tags.forEach((tag) => {
      const pill = document.createElement("span");
      pill.className = "mini-tag";
      pill.textContent = tag;
      tagsContainer.append(pill);
    });

    item.addEventListener("click", () => {
      state.selectedId = note.id;
      render();
    });

    notesList.append(item);
  });
}

function renderEditor() {
  const note = getSelectedNote();

  if (!note) {
    noteStatus.textContent = "No note selected";
    updatedAt.textContent = "Saved locally";
    noteTitle.value = "";
    noteBody.value = "";
    tagList.innerHTML = "";
    return;
  }

  noteStatus.textContent = note.title || "Untitled note";
  updatedAt.textContent = `Updated ${formatDate(note.updatedAt)}`;
  noteTitle.value = note.title;
  noteBody.value = note.body;
  tagList.innerHTML = "";

  note.tags.forEach((tag) => {
    const pill = tagPillTemplate.content.firstElementChild.cloneNode(true);
    pill.querySelector(".tag-label").textContent = tag;
    pill.querySelector(".tag-remove").addEventListener("click", () => removeTag(tag));
    tagList.append(pill);
  });
}

function render() {
  renderNotesList();
  renderEditor();
}

newNoteButton.addEventListener("click", createNote);
deleteNoteButton.addEventListener("click", deleteSelectedNote);
addTagButton.addEventListener("click", addTag);

noteTitle.addEventListener("input", (event) => {
  updateSelectedNote({ title: event.target.value });
});

noteBody.addEventListener("input", (event) => {
  updateSelectedNote({ body: event.target.value });
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderNotesList();
});

tagInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addTag();
  }
});

if (!state.selectedId) {
  createNote();
} else {
  render();
}
