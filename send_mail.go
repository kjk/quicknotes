package main

import (
	"fmt"
	"strings"

	"net/http"

	"github.com/SparkPost/gosparkpost"
	"github.com/kjk/quicknotes/pkg/log"
)

const (
	sparkpostKey = "0f6d54023ed5e6e4beb0c55e8f910064a5605151"
	mailFrom     = "QuickNotes Stats <info@quicknotes.io>"
	mailTo       = "kkowalczyk@gmail.com"
)

func sendMail(subject, body string) {
	cfg := &gosparkpost.Config{
		BaseUrl:    "https://api.sparkpost.com",
		ApiKey:     sparkpostKey,
		ApiVersion: 1,
	}

	var sparky gosparkpost.Client
	err := sparky.Init(cfg)
	if err != nil {
		log.Errorf("sparky.Init() failed with: '%s'\n", err)
		return
	}
	sparky.Client = http.DefaultClient

	tx := &gosparkpost.Transmission{
		Recipients: []string{mailTo},
		Content: gosparkpost.Content{
			Text:    body,
			From:    mailFrom,
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
	recentNotes, _ := dbGetLastDayNotes()
	a := []string{
		"QuickNotes stats:",
		fmt.Sprintf("users: %d", nUsers),
		fmt.Sprintf("notes: %d", nNotes),
		fmt.Sprintf("versions: %d", nVersions),
		fmt.Sprintf("notes updated or modified yesterday: %d", len(recentNotes)),
	}
	for _, n := range recentNotes {
		userInfo, err := getCachedUserInfo(n.userID)
		if err != nil {
			log.Errorf("getCachedUserInfo(%d) failed with %s\n", n.userID, err)
			continue
		}
		uri := "https://quicknotes.io/n/" + hashInt(n.id)
		s := fmt.Sprintf("Title: %s, user: %s, url: %s", n.Title, userInfo.user.GetHandle(), uri)
		a = append(a, s)
	}
	return strings.Join(a, "\n")
}

func sendStatsMail() {
	subject := utcNow().Format("QuickNotes stats on 2006-01-02 15:04:05")
	body := getStatsEmailBody()
	sendMail(subject, body)
}

func sendBootMail() {
	subject := utcNow().Format("QuickNotes started on 2006-01-02 15:04:05")
	body := "Just letting you know that I've started\n"
	body += fmt.Sprintf("production: %v, proddb: %v, sql connection: %s, data dir: %s, redirectHTTPS: %v\n", flgProduction, flgProdDb, getSQLConnectionSanitized(), getDataDir(), redirectHTTPS)
	sendMail(subject, body)
}

func testSendEmail() {
	subject := utcNow().Format("QuickNotes stats on 2006-01-02 15:04:05")
	body := "this is a test e-mail"
	sendMail(subject, body)
}
