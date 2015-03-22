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

function getDeletedNotdeletedNotes(notes) {
  var deleted = [];
  var notDeleted = [];
  for (var i = 0; i < notes.length; i++) {
    var note = notes[i];
    if (note.IsDeleted) {
      deleted.push(note);
    } else {
      notDeleted.push(note);
    }
  }
  return {
    deleted: deleted,
    notDeleted: notDeleted
  }
}

function filterNotesByTag(notes, tag) {
  var specialNotes = getDeletedNotdeletedNotes(notes);
  if (tag === "" || tag == "__all") {
    return specialNotes.notDeleted;
  }
  if (tag == "__deleted") {
    return specialNotes.deleted;
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
