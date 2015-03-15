var noteCodeMirror;
var isDialog = true;
var titleInitial;
var editorChanged;

function enableDisableSave() {
    var enable = editorChanged;
    if (!enable) {
        var el = $("#note-title");
        if (!el.hasClass("title-placeholder")) {
            var currTitle = $.trim(el.text());
            if (currTitle != titleInitial) {
                enable = true;
            }
        }
    }

    if (enable) {
        $("#btn-save").removeClass("btn-disabled");
    } else {
        $("#btn-save").addClass("btn-disabled");
    }
}

function onCmChanged(cm) {
    console.log("code-mirror changed");
    editorChanged = true;
    enableDisableSave();
};

function isEmpty(cm) {
    return (cm.lineCount() === 1) && (cm.getLine(0) === "");
}

function positionNoteEditor() {
    var el = $(window);
    var dx = el.width();
    var dy = el.height();
    $("#note-editor").width(dx-128).height(dy-72);
    var editorDy = dy - 72 - $("#note-bottom").height() - $("#note-top").height() - 4;
    noteCodeMirror.setSize(null, editorDy);
}

function onWindowResize() {
    positionNoteEditor();
}

function showNoteEditor() {
    if (isDialog) {
        var el = document.querySelector('#note-editor');
        el.showModal();
    } else {
        $("#note-editor").show();
    }
}

function editNote(note) {
    console.log("editNote: id: " + note.Id + " title: " + note.Title);
    noteCodeMirror.setValue(note.Content);
    $("#note-title").text(note.Title);
    showNoteEditor();
    editorChanged = false;
    enableDisableSave();
    positionNoteEditor();
}

function editNoteStart(noteId) {
    // TODO: add progress indicator
    $.getJSON("/api/getnote.json", {
        id: noteId
    }).done(editNote);
    // TODO: add failed
}

function newNote() {
    showNoteEditor();
    titleInitial = "";
    $("#note-title").addClass("title-placeholder").text("Title");
    noteCodeMirror.setValue("t");
    noteCodeMirror.focus();
    noteCodeMirror.setValue("");
    editorChanged = false;
    enableDisableSave();
    positionNoteEditor();
}

$(document).ready(function() {
    $(window).resize(function() {
        onWindowResize();
    });

    $("#btn-save").click(function() {
        console.log("btn-save clicked");
    });

    $("#note-close").click(function() {
        console.log("closed #note-editor");
        if (isDialog) {
            var el = document.querySelector('#note-editor');
            el.close();
        } else {
            $("#note-editor").hide();
        }
    });

    $("#new-note").click(function() {
        newNote();
    });

    $("#new-note").blur(function() {
        $(this).val('Add new note (Ctrl-N)');
    });

    if (!isDialog) {
        $("#note-editor").hide();
    }

    $("#note-title").focus(function() {
        var s = $.trim($(this).text());
        if ($(this).hasClass("title-placeholder")) {
            $(this).removeClass("title-placeholder");
            $(this).text("");
            $(this).focus();
        }
    });

    $("#note-title").blur(function() {
        var s = $.trim($(this).text());
        if (s == "") {
            $("#note-title").text("Title").addClass("title-placeholder");
        }
    })

    $("#search").focus(function() {
        $(this).val('');
    });
    $("#search").blur(function() {
        $(this).val('Search (Ctrl-S)');
    });

    $(".one-note").mouseenter(function(event) {
        var id = $(this).attr("id").substring(5);
        $("#note-edit-btn-" + id).show().click(function() {
            var id = $(this).attr("id").substring(14);
            editNoteStart(id);
        });
    });

    $(".one-note").mouseleave(function() {
        var id = $(this).attr("id").substring(5);
        $("#note-edit-btn-" + id).hide();
    });

    var noteTextArea = document.getElementById("note-text-area");
    noteCodeMirror = CodeMirror.fromTextArea(noteTextArea, {
        theme: "solarized light",
        autofocus: true
    });

    noteCodeMirror.on("change", onCmChanged);
});
