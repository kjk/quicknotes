package main

import (
	"fmt"
	"net/http"

	"github.com/kjk/simplenote"
)

// url: GET /importsimplenote
func handleImportSimpleNote(w http.ResponseWriter, r *http.Request) {
	LogInfof("handleImportSimpleNote(): url: '%s'\n", r.URL.Path)
	user := getUserFromCookie(w, r)
	fmt.Printf("Importing for user: %s\n", user.Login)
	client := simplenote.NewClient("api_key", "user", "password")
}
