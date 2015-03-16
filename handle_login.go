package main

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"golang.org/x/oauth2"
)

var (
	// random string for oauth2 API calls to protect against CSRF
	oauthSecretString = "5576867039"

	githubEndpoint = oauth2.Endpoint{
		AuthURL:  "https://github.com/login/oauth/authorize",
		TokenURL: "https://github.com/login/oauth/access_token",
	}

	twitterEndpoint = oauth2.Endpoint{
		AuthURL:  "https://api.twitter.com/oauth/authorize",
		TokenURL: "https://api.twitter.com/oauth/access_token",
	}

	oauthGitHubConf = &oauth2.Config{
		ClientID:     "",
		ClientSecret: "",
		// select level of access you want https://developer.github.com/v3/oauth/#scopes
		Scopes:   []string{"user:email", "repo"},
		Endpoint: githubEndpoint,
	}
)

type SecureCookieValue struct {
	UserID string
}

func setSecureCookie(w http.ResponseWriter, cookieVal *SecureCookieValue) {
	val := make(map[string]string)
	val["user"] = cookieVal.UserID
	if encoded, err := secureCookie.Encode(cookieName, val); err == nil {
		// TODO: set expiration (Expires    time.Time) long time in the future?
		cookie := &http.Cookie{
			Name:  cookieName,
			Value: encoded,
			Path:  "/",
		}
		http.SetCookie(w, cookie)
	} else {
		fmt.Printf("setSecureCookie(): error encoding secure cookie %s\n", err)
	}
}

const weekInSeconds = 60 * 60 * 24 * 7

// to delete the cookie value (e.g. for logging out), we need to set an
// invalid value
func deleteSecureCookie(w http.ResponseWriter) {
	cookie := &http.Cookie{
		Name:   cookieName,
		Value:  "deleted",
		MaxAge: weekInSeconds,
		Path:   "/",
	}
	http.SetCookie(w, cookie)
}

func getSecureCookie(r *http.Request) *SecureCookieValue {
	var ret *SecureCookieValue
	if cookie, err := r.Cookie(cookieName); err == nil {
		// detect a deleted cookie
		if "deleted" == cookie.Value {
			return nil
		}
		val := make(map[string]string)
		if err = secureCookie.Decode(cookieName, cookie.Value, &val); err != nil {
			// most likely expired cookie, so ignore. Ideally should delete the
			// cookie, but that requires access to http.ResponseWriter, so not
			// convenient for us
			//fmt.Printf("Error decoding cookie %s\n", err)
			return nil
		}
		//fmt.Printf("Got cookie %q\n", val)
		ret = new(SecureCookieValue)
		var ok bool
		if ret.UserID, ok = val["user"]; !ok {
			fmt.Printf("Error decoding cookie, no 'user' field\n")
			return nil
		}

	}
	return ret
}

func decodeUserFromCookie(r *http.Request) string {
	cookie := getSecureCookie(r)
	if nil == cookie {
		return ""
	}
	return cookie.UserID
}

// url: GET /logintwittercb?redirect=$redirect
func handleOauthTwitterCallback(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("handleOauthTwitterCallback()\n")
	state := r.FormValue("state")
	if state != oauthSecretString {
		fmt.Printf("invalid oauth state, expected '%s', got '%s'\n", oauthSecretString, state)
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}

	oauthTwitterConf := &oauth2.Config{
		ClientID:     "rYmWoMXQ3Wwx69do31TW4DRes",
		ClientSecret: "wdDXapzG5zEeQ7ToJnABvBIoGmLFLdvueT7vGMPjCvjUNAU928",
		// select level of access you want https://developer.github.com/v3/oauth/#scopes
		Scopes:   []string{"user:email", "repo"},
		Endpoint: twitterEndpoint,
	}

	code := r.FormValue("code")
	token, err := oauthTwitterConf.Exchange(oauth2.NoContext, code)
	if err != nil {
		fmt.Printf("oauthTwitterConf.Exchange() failed with '%s'\n", err)
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}

	fmt.Printf("twitter token: %#v\n", token)
	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}

// url: GET /logintwitter?redirect=$redirect
func handleLoginTwitter(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("handleLoginTwitter\n")
	redirect := strings.TrimSpace(r.FormValue("redirect"))
	if redirect == "" {
		httpErrorf(w, "Missing redirect value for /logintwitter")
		return
	}

	q := url.Values{
		"redirect": {redirect},
	}.Encode()
	cb := "http://" + r.Host + "/logintwittercb?" + q

	oauthTwitterConf := &oauth2.Config{
		ClientID:     "rYmWoMXQ3Wwx69do31TW4DRes",
		ClientSecret: "wdDXapzG5zEeQ7ToJnABvBIoGmLFLdvueT7vGMPjCvjUNAU928",
		Endpoint:     twitterEndpoint,
		RedirectURL:  cb,
	}
	uri := oauthTwitterConf.AuthCodeURL(oauthSecretString, oauth2.AccessTypeOnline)
	http.Redirect(w, r, uri, http.StatusTemporaryRedirect)
}

// /logingithub?redirect=$redirect
func handleLoginGitHub(w http.ResponseWriter, r *http.Request) {
	redirect := strings.TrimSpace(r.FormValue("redirect"))
	if redirect == "" {
		httpErrorf(w, "Missing redirect value for /logintwitter")
		return
	}
	uri := oauthGitHubConf.AuthCodeURL(oauthSecretString, oauth2.AccessTypeOnline)
	http.Redirect(w, r, uri, http.StatusTemporaryRedirect)
}

// url: GET /logout?redirect=$redirect
func handleLogout(w http.ResponseWriter, r *http.Request) {
	redirect := strings.TrimSpace(r.FormValue("redirect"))
	if redirect == "" {
		httpErrorf(w, "Missing redirect value for /logout")
		return
	}
	deleteSecureCookie(w)
	http.Redirect(w, r, redirect, 302)
}
