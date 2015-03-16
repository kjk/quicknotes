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

function filterNotesByTag(notes, tag) {
  if (tag === "") {
    return notes;
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

exports.filterNotesByTag = filterNotesByTag;
