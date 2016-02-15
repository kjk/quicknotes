package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/kjk/log"
	"github.com/mostafah/mandrill"
)

func getStatsEmailBody() string {
	nUsers, _ := dbGetUsersCount()
	nNotes, _ := dbGetNotesCount()
	nVersions, _ := dbGetVersionsCount()
	a := []string{
		"QuickNotes stats",
		fmt.Sprintf("Users: %d", nUsers),
		fmt.Sprintf("Notes: %d", nNotes),
		fmt.Sprintf("Versions: %d", nVersions),
	}
	return strings.Join(a, "\n")
}

func sendStatsMail() {
	mandrill.Key = "xmSus9bPNB7qI5_G7_Iibg"
	err := mandrill.Ping()
	if err != nil {
		log.Errorf("mandrill.Ping() failed with %s\n", err)
		return
	}
	msg := mandrill.NewMessageTo("kkowalczyk@gmail.com", "Krzysztof Kowalczyk")
	msg.Text = getStatsEmailBody()
	msg.Subject = time.Now().Format("Quicknotes stats on 2006-01-02")
	msg.FromEmail = "info@quicknotes.io"
	msg.FromName = "QuickNotes Stats"
	_, err = msg.Send(false)
	if err != nil {
		log.Errorf("msg.Send() failed with %s\n", err)
	}
}
