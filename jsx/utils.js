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
  for (var i = 0; i < notes.length; i++) {
    var note = notes[i];
    if (note.IsDeleted) {
      deleted.push(note);
    } else {
      notDeleted.push(note);
      if (note.IsPublic) {
        public.push(note);
      }
    }
  }
  return {
    deleted: deleted,
    notDeleted: notDeleted,
    public: public
  };
}

function isSpecialTag(tag) {
  switch (tag) {
    case "":
    case "__all":
    case "__deleted":
    case "__public":
      return true;
  }
  return false;
}

function filterNotesByTag(notes, tag) {
  if (isSpecialTag(tag)) {
    var specialNotes = getSpecialNotes(notes);
    if (tag === "" || tag == "__all") {
      return specialNotes.notDeleted;
    }
    if (tag == "__deleted") {
      return specialNotes.deleted;
    }
    if (tag == "__public") {
      return specialNotes.public;
    }
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
