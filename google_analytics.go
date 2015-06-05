package main

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

const (
	gaTrackingID = "UA-63795039-1"
	gaDomainName = "quicknotes.io"
	beaconURL    = "http://www.google-analytics.com/collect"
)

var (
	errMissingUserAgent     = errors.New("Missing user agent")
	errMissingClientID      = errors.New("Missing client ID")
	errMissingPagePath      = errors.New("Missing page path")
	errMissingIP            = errors.New("Missing IP")
	errMissingEventCategory = errors.New("Missing Event Category")
	errMissingEventAction   = errors.New("Missing Event Action")
	errNegativeValue        = errors.New("Negative Event Value")
)

func generateUUID() string {
	var b [16]byte
	rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

func gaLog(ua string, values url.Values) error {
	c := &http.Client{}
	req, _ := http.NewRequest("POST", beaconURL, strings.NewReader(values.Encode()))

	if ua != "" {
		req.Header.Add("User-Agent", ua)
	}

	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.Do(req)

	if err != nil {
		LogErrorf("GAEvent Recording error '%s'", err)
		return err
	}
	resp.Body.Close()
	return nil
}

func gaLogPageView(ua string, cid string, ip string, pagePath string, pageTitle string, params map[string]string) error {
	if ua == "" {
		return errMissingUserAgent
	}
	if cid == "" {
		return errMissingClientID
	}
	if pagePath == "" {
		return errMissingPagePath
	}
	if ip == "" {
		return errMissingIP
	}

	payload := url.Values{
		"v":   {"1"},          // protocol version = 1
		"t":   {"pageview"},   // hit type
		"tid": {gaTrackingID}, // tracking / property ID
		"cid": {cid},          // unique client ID (server generated UUID)
		"dp":  {pagePath},     // page path
		"uip": {ip},           // IP address of the user
		"dh":  {gaDomainName}, // Domain name of site
	}

	if pageTitle != "" {
		payload["dt"] = []string{pageTitle}
	}

	for key, val := range params {
		payload[key] = []string{val}
	}

	return gaLog(ua, payload)
}

func gaLogEvent(cid string, category string, action string, label string,
	value string, params map[string]string) error {
	if cid == "" {
		return errMissingClientID
	}
	if category == "" {
		return errMissingEventCategory
	}
	if action == "" {
		return errMissingEventAction
	}

	val, intErr := strconv.Atoi(value)
	if intErr != nil || val < 0 {
		return errNegativeValue
	}

	payload := url.Values{
		"v":   {"1"},          // protocol version = 1
		"t":   {"event"},      // hit type
		"tid": {gaTrackingID}, // tracking / property ID
		"cid": {cid},          // unique client ID (server generated UUID)
		"ec":  {category},     // Event Category
		"ea":  {action},       // Action taken
	}

	if label != "" {
		payload["el"] = []string{label}
	}

	if value != "" {
		payload["ev"] = []string{value}
	}

	for key, val := range params {
		payload[key] = []string{val}
	}

	return gaLog("", payload)
}
