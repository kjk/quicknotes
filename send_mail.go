package main

import (
	"fmt"
	"strings"

	sp "github.com/SparkPost/gosparkpost"
	"github.com/kjk/log"
)

const (
	sparkpostKey = "0f6d54023ed5e6e4beb0c55e8f910064a5605151"
)

func sendMail(subject, body, from string) {
	var sparky sp.Client
	err := sparky.Init(&sp.Config{ApiKey: sparkpostKey})
	if err != nil {
		log.Errorf("sparky.Init() failed with: '%s'\n", err)
		return
	}

	tx := &sp.Transmission{
		Recipients: []string{"kkowalczyk@gmail.com"},
		Content: sp.Content{
			Text:    body,
			From:    from,
			Subject: subject,
		},
	}
	_, _, err = sparky.Send(tx)
	if err != nil {
		log.Errorf("sparky.Send() failed with '%s'\n", err)
	}
}

func getStatsEmailBody() string {
	nUsers, _ := dbGetUsersCount()
	nNotes, _ := dbGetNotesCount()
	nVersions, _ := dbGetVersionsCount()
	a := []string{
		"QuickNotes stats:",
		fmt.Sprintf("users: %d", nUsers),
		fmt.Sprintf("notes: %d", nNotes),
		fmt.Sprintf("versions: %d", nVersions),
	}
	return strings.Join(a, "\n")
}

func sendStatsMail() {
	subject := utcNow().Format("QuickNotes stats on 2006-01-02 15:04:05")
	body := getStatsEmailBody()
	sendMail(subject, body, "QuickNotes Stats <info@quicknotes.io>")
}

func sendBootMail() {
	subject := utcNow().Format("QuickNotes started on 2006-01-02 15:04:05")
	body := "Just letting you know that I've started\n"
	body += fmt.Sprintf("local: %v, proddb: %v, sql connection: %s, data dir: %s\n", flgIsLocal, flgProdDb, getSQLConnectionRoot(), getDataDir())
	sendMail(subject, body, "QuickNotes <info@quicknotes.io>")
}

func testSendEmail() {
	subject := utcNow().Format("QuickNotes stats on 2006-01-02 15:04:05")
	body := "this is a test e-mail"
	sendMail(subject, body, "QuickNotes Stats <info@quicknotes.io>")
}
