function noteHasTag(note, tag) {
  var tags = note.Tags;
  if (!tags) {
    return false;
  }
  for (var i = 0; i < tags.length; i++) {
    if (tags[i] == tag) {
      return true;
    }
  }
  return false;
}

function getSpecialNotes(notes) {
  var deleted = [];
  var notDeleted = [];
  var public = [];
  var private = [];
  var starred = [];
  for (var i = 0; i < notes.length; i++) {
    var note = notes[i];
    if (note.IsDeleted) {
      deleted.push(note);
    } else {
      notDeleted.push(note);
      if (note.IsPublic) {
        public.push(note);
      } else {
        private.push(note);
      }
      if (note.IsStarred) {
        starred.push(note);
      }
    }
  }
  return {
    __all: notDeleted,
    __deleted: deleted,
    __public: public,
    __private: private,
    __starred: starred,
  };
}

function isSpecialTag(tag) {
  switch (tag) {
    case "__all":
    case "__deleted":
    case "__public":
    case "__private":
    case "__starred":
      return true;
  }
  return false;
}

function filterNotesByTag(notes, tag) {
  if (isSpecialTag(tag)) {
    var specialNotes = getSpecialNotes(notes);
    return specialNotes[tag];
  }

  var res = [];
  for (var i = 0; i < notes.length; i++) {
    var note = notes[i];
    if (noteHasTag(note, tag)) {
      res.push(note);
    }
  }
  return res;
}

function dictInc(d, key) {
  if (d[key]) {
    d[key] += 1;
  } else {
    d[key] = 1;
  }
}

exports.filterNotesByTag = filterNotesByTag;
exports.dictInc = dictInc;
