package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/kjk/log"
	"github.com/mostafah/mandrill"
)

func init() {
	mandrill.Key = "xmSus9bPNB7qI5_G7_Iibg"
}

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

func sendMail(subject, body, from string) {
	err := mandrill.Ping()
	if err != nil {
		log.Errorf("mandrill.Ping() failed with %s\n", err)
		return
	}
	msg := mandrill.NewMessageTo("kkowalczyk@gmail.com", "Krzysztof Kowalczyk")
	msg.Subject = subject
	msg.Text = body
	msg.FromEmail = "info@quicknotes.io"
	msg.FromName = from
	_, err = msg.Send(false)
	if err != nil {
		log.Errorf("msg.Send() failed with %s\n", err)
	}
}

func sendStatsMail() {
	subject := time.Now().Format("QuickNotes stats on 2006-01-02")
	body := getStatsEmailBody()
	sendMail(subject, body, "QuickNotes Stats")
}

func sendBootMail() {
	subject := time.Now().Format("QuickNotes started on 2006-01-02")
	body := "Just letting you know that I've started\n"
	body += fmt.Sprintf("local: %v, proddb: %v, sql connection: %s, data dir: %s\n", flgIsLocal, flgProdDb, getSQLConnectionRoot(), getDataDir())
	sendMail(subject, body, "QuickNotes")
}
