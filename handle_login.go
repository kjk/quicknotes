package main

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"strings"
	"sync"

	"github.com/garyburd/go-oauth/oauth"
	"github.com/google/go-github/github"
	"github.com/gorilla/securecookie"
	"github.com/kjk/log"
	"github.com/kjk/u"
	"golang.org/x/oauth2"
	goauth2 "google.golang.org/api/oauth2/v2"
)

const (
	cookieAuthKeyHex = "513521f0ef43c9446ed7bf359a5a9700ef5fa5a5eb15d0db5eae8e93856d99bd"
	cookieEncrKeyHex = "4040ed16d4352320b5a7f51e26443342d55a0f46be2acfe5ba694a123230376a"
	cookieName       = "qnckie" // "quicknotes cookie"

	// random string for oauth2 API calls to protect against CSRF
	oauthSecretPrefix = "5576867039-"
)

var (
	cookieAuthKey []byte
	cookieEncrKey []byte

	secureCookie *securecookie.SecureCookie

	githubEndpoint = oauth2.Endpoint{
		AuthURL:  "https://github.com/login/oauth/authorize",
		TokenURL: "https://github.com/login/oauth/access_token",
	}

	googleEndpoint = oauth2.Endpoint{
		AuthURL:  "https://accounts.google.com/o/oauth2/auth",
		TokenURL: "https://accounts.google.com/o/oauth2/token",
	}

	oauthGoogleConf = &oauth2.Config{
		ClientID:     "393285548407-rau0ccv7h7chin1auv5v179jdq7rkvqf.apps.googleusercontent.com",
		ClientSecret: "KP7eRR9zVPlY3fXNeTUl5ZIr",
		Scopes:       []string{goauth2.UserinfoProfileScope, goauth2.UserinfoEmailScope},
		Endpoint:     googleEndpoint,
	}

	oauthGitHubConf = &oauth2.Config{
		ClientID:     "0de5b60a98b0f3fbb187",
		ClientSecret: "a46a61a26d7841a5206b5e1d9313cf3e3f1150e8",
		// select level of access you want https://developer.github.com/v3/oauth/#scopes
		Scopes:   []string{"user:email", "repo"},
		Endpoint: githubEndpoint,
	}

	oauthTwitterClient = oauth.Client{
		TemporaryCredentialRequestURI: "https://api.twitter.com/oauth/request_token",
		TokenRequestURI:               "https://api.twitter.com/oauth/access_token",
		ResourceOwnerAuthorizationURI: "https://api.twitter.com/oauth/authenticate",
		Credentials: oauth.Credentials{
			Secret: "wdDXapzG5zEeQ7ToJnABvBIoGmLFLdvueT7vGMPjCvjUNAU928",
			Token:  "rYmWoMXQ3Wwx69do31TW4DRes",
		},
	}

	muLogin     sync.Mutex
	tempSecrets = map[string]string{}
)

// SecureCookieValue is value of the cookie
type SecureCookieValue struct {
	UserID int
}

func initCookieMust() {
	var err error
	cookieAuthKey, err = hex.DecodeString(cookieAuthKeyHex)
	u.PanicIfErr(err)
	cookieEncrKey, err = hex.DecodeString(cookieEncrKeyHex)
	u.PanicIfErr(err)
	secureCookie = securecookie.New(cookieAuthKey, cookieEncrKey)
	// verify auth/encr keys are correct
	val := map[string]string{
		"foo": "bar",
	}
	_, err = secureCookie.Encode(cookieName, val)
	u.PanicIfErr(err)
}

func setSecureCookie(w http.ResponseWriter, cookieVal *SecureCookieValue) {
	if encoded, err := secureCookie.Encode(cookieName, cookieVal); err == nil {
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

func getSecureCookie(w http.ResponseWriter, r *http.Request) *SecureCookieValue {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		return nil
	}
	// detect a deleted cookie
	if "deleted" == cookie.Value {
		return nil
	}
	var ret SecureCookieValue
	if err = secureCookie.Decode(cookieName, cookie.Value, &ret); err != nil {
		// most likely expired cookie, so ignore and delete
		log.Errorf("secureCookie.Decode() failed with %s\n", err)
		deleteSecureCookie(w)
		return nil
	}
	//log.Verbosef("Got cookie %#v\n", ret)
	return &ret
}

func getDbUserFromCookie(w http.ResponseWriter, r *http.Request) *DbUser {
	sc := getSecureCookie(w, r)
	if sc == nil {
		return nil
	}
	user, err := dbGetUserByID(sc.UserID)
	if err != nil {
		log.Errorf("dbGetUserById(%d) failed with %s\n", sc.UserID, err)
		return nil
	}
	return user
}

func putTempCredentials(cred *oauth.Credentials) {
	muLogin.Lock()
	defer muLogin.Unlock()
	tempSecrets[cred.Token] = cred.Secret
}

func getTempCredentials(token string) *oauth.Credentials {
	muLogin.Lock()
	defer muLogin.Unlock()
	if secret, ok := tempSecrets[token]; ok {
		return &oauth.Credentials{Token: token, Secret: secret}
	}
	return nil
}

func deleteTempCredentials(token string) {
	muLogin.Lock()
	defer muLogin.Unlock()
	delete(tempSecrets, token)
}

func getMyHost(r *http.Request) string {
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	return scheme + "://" + r.Host
}

// getTwitter gets a resource from the Twitter API and decodes the json response to data.
func getTwitter(cred *oauth.Credentials, urlStr string, params url.Values, data interface{}) error {
	if params == nil {
		params = make(url.Values)
	}
	oauthTwitterClient.SignParam(cred, "GET", urlStr, params)
	resp, err := http.Get(urlStr + "?" + params.Encode())
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	bodyData, _ := ioutil.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return fmt.Errorf("GET %s returned status %d, %s", urlStr, resp.StatusCode, bodyData)
	}
	//fmt.Printf("getTwitter(): json: %s\n", string(bodyData))
	return json.Unmarshal(bodyData, data)
}

// if loggin from main page, go to user's notes
func fixLoginRedir(redir string, u *DbUser) string {
	if u != nil && (redir == "/" || redir == "") {
		redir = "/u/" + hashInt(u.ID)
		h := url.QueryEscape(u.GetHandle())
		if h != "" {
			redir += "/" + u.GetHandle()
		}
	}
	return redir
}

// url: GET /logintwittercb?redir=${redirect}
func handleOauthTwitterCallback(w http.ResponseWriter, r *http.Request) {
	redir := strings.TrimSpace(r.FormValue("redir"))
	log.Verbosef("url: '%s', redir: '%s'\n", r.URL, redir)
	tempCred := getTempCredentials(r.FormValue("oauth_token"))
	if tempCred == nil {
		http.Error(w, "Unknown oauth_token.", 500)
		return
	}
	deleteTempCredentials(tempCred.Token)
	tokenCred, _, err := oauthTwitterClient.RequestToken(nil, tempCred, r.FormValue("oauth_verifier"))
	if err != nil {
		http.Error(w, "Error getting request token, "+err.Error(), 500)
		return
	}
	putTempCredentials(tokenCred)
	//fmt.Printf("tempCred: %#v\n", tempCred)
	//fmt.Printf("tokenCred: %#v\n", tokenCred)

	var info map[string]interface{}
	uri := "https://api.twitter.com/1.1/account/verify_credentials.json"
	err = getTwitter(tokenCred, uri, nil, &info)
	if err != nil {
		http.Error(w, "Error getting timeline, "+err.Error(), 500)
		return
	}
	twitterHandle, okUser := info["screen_name"].(string)
	if !okUser {
		log.Errorf("no 'screen_name' in %#v\n", info)
		// TODO: show error to the user
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}

	fullName, _ := info["name"].(string)
	// also might be useful:
	// email
	// avatar_url
	userLogin := "twitter:" + twitterHandle
	// TODO: oauthJSON
	dbUser, err := dbGetOrCreateUser(userLogin, fullName)
	if err != nil {
		log.Errorf("dbGetOrCreateUser('%s', '%s') failed with '%s'\n", userLogin, fullName, err)
		// TODO: show error to the user
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}
	log.Verbosef("got or created user %d, login: '%s'\n", dbUser.ID, userLogin)
	cookieVal := &SecureCookieValue{
		UserID: dbUser.ID,
	}
	setSecureCookie(w, cookieVal)

	redir = fixLoginRedir(redir, dbUser)
	http.Redirect(w, r, redir, http.StatusTemporaryRedirect)
}

// url: GET /logintwitter?redir=${redirect}
func handleLoginTwitter(w http.ResponseWriter, r *http.Request) {
	redir := strings.TrimSpace(r.FormValue("redir"))
	log.Verbosef("url: '%s', redir: '%s'\n", r.URL, redir)

	q := url.Values{
		"redir": {redir},
	}.Encode()
	scheme := r.URL.Scheme
	if scheme == "" {
		scheme = "http"
	}
	cb := getMyHost(r) + "/logintwittercb?" + q
	tempCred, err := oauthTwitterClient.RequestTemporaryCredentials(nil, cb, nil)
	if err != nil {
		httpErrorf(w, "oauthTwitterClient.RequestTemporaryCredentials() failed with '%s'", err)
		return
	}
	putTempCredentials(tempCred)
	http.Redirect(w, r, oauthTwitterClient.AuthorizationURL(tempCred, nil), http.StatusTemporaryRedirect)
}

func tokenToJSON(token *oauth2.Token) (string, error) {
	d, err := json.Marshal(token)
	if err != nil {
		return "", err
	}
	return string(d), nil
}

func tokenFromJSON(jsonStr string) (*oauth2.Token, error) {
	var token oauth2.Token
	if err := json.Unmarshal([]byte(jsonStr), &token); err != nil {
		return nil, err
	}
	return &token, nil
}

// logingithubcb
func handleOauthGitHubCallback(w http.ResponseWriter, r *http.Request) {
	state := r.FormValue("state")
	if !strings.HasPrefix(state, oauthSecretPrefix) {
		log.Errorf("invalid oauth state, expected '%s', got '%s'\n", oauthSecretPrefix, state)
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}

	// extract redir from secret (added in handleLoginGitHub
	redir := state[len(oauthSecretPrefix):]
	if redir == "" {
		log.Errorf("missing 'redir' arg\n")
		redir = "/"
	}
	log.Verbosef("url: '%s', state: '%s', redir: '%s'\n", r.URL, state, redir)

	code := r.FormValue("code")
	token, err := oauthGitHubConf.Exchange(oauth2.NoContext, code)
	if err != nil {
		log.Errorf("oauthGitHubConf.Exchange() failed with '%s'\n", err)
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}

	oauthClient := oauthGitHubConf.Client(oauth2.NoContext, token)
	client := github.NewClient(oauthClient)
	user, _, err := client.Users.Get("")
	if err != nil {
		log.Errorf("client.Users.Get() faled with '%s'\n", err)
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}
	log.Infof("logged in as GitHub user: %s\n", *user.Login)
	githubLogin := *user.Login
	fullName := *user.Name

	// also might be useful:
	// profile_image_url
	// profile_image_url_https
	userLogin := "github:" + githubLogin
	dbUser, err := dbGetOrCreateUser(userLogin, fullName)
	if err != nil {
		log.Errorf("dbGetOrCreateUser('%s', '%s') failed with '%s'\n", userLogin, fullName, err)
		// TODO: show error to the user
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}
	log.Infof("got or created user %d, login: '%s'\n", dbUser.ID, userLogin)
	cookieVal := &SecureCookieValue{
		UserID: dbUser.ID,
	}
	setSecureCookie(w, cookieVal)

	redir = fixLoginRedir(redir, dbUser)
	http.Redirect(w, r, redir, http.StatusTemporaryRedirect)
}

// /logingithub?redir=${redirect}
func handleLoginGitHub(w http.ResponseWriter, r *http.Request) {
	redir := strings.TrimSpace(r.FormValue("redir"))
	if redir == "" {
		httpErrorf(w, "Missing 'redir' value for /logingithub")
		return
	}
	log.Verbosef("redir: '%s'\n", redir)

	oauthCopy := oauthGitHubConf
	// GitHub seems to completely ignore Redir, so unfortunately we'll
	// alwayas end up on quicknotes.io, which makes testing locally hard
	// encode redir in state
	uri := oauthCopy.AuthCodeURL(oauthSecretPrefix+redir, oauth2.AccessTypeOnline)
	http.Redirect(w, r, uri, http.StatusTemporaryRedirect)
}

// logingooglecb
func handleOauthGoogleCallback(w http.ResponseWriter, r *http.Request) {
	state := r.FormValue("state")
	if !strings.HasPrefix(state, oauthSecretPrefix) {
		log.Errorf("invalid oauth state, expected '%s*', got '%s'\n", oauthSecretPrefix, state)
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}

	// extract redir from secret (added in handleLoginGoogle)
	redir := state[len(oauthSecretPrefix):]
	if redir == "" {
		log.Errorf("missing redir in state\n")
		redir = "/"
	}
	log.Verbosef("url: '%s', state: '%s', redir: '%s'\n", r.URL, state, redir)

	code := r.FormValue("code")
	token, err := oauthGoogleConf.Exchange(oauth2.NoContext, code)
	if err != nil {
		log.Errorf("oauthGoogleConf.Exchange() failed with '%s'\n", err)
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}

	oauthClient := oauthGoogleConf.Client(oauth2.NoContext, token)
	service, err := goauth2.New(oauthClient)
	if err != nil {
		log.Errorf("goauth2.New() failed with %s\n", err)
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}

	call := service.Userinfo.Get()
	userInfo, err := call.Do()
	if err != nil {
		log.Errorf("call.Do() failed with %s", err)
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}

	log.Verbosef("logged in as Google user: '%s'\n", userInfo.Email)
	fullName := userInfo.Name

	// also might be useful:
	// Picture
	userLogin := "google:" + nameFromEmail(userInfo.Email)
	dbUser, err := dbGetOrCreateUser(userLogin, fullName)
	if err != nil {
		log.Errorf("dbGetOrCreateUser('%s', '%s') failed with '%s'\n", userLogin, fullName, err)
		// TODO: show error to the user
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}
	log.Infof("got or created user %d, login: '%s'\n", dbUser.ID, userLogin)
	cookieVal := &SecureCookieValue{
		UserID: dbUser.ID,
	}
	setSecureCookie(w, cookieVal)

	redir = fixLoginRedir(redir, dbUser)
	http.Redirect(w, r, redir, http.StatusTemporaryRedirect)
}

// /logingoogle?redir=${redirect}
func handleLoginGoogle(w http.ResponseWriter, r *http.Request) {
	redir := strings.TrimSpace(r.FormValue("redir"))
	if redir == "" {
		httpErrorf(w, "Missing 'redir' arg for /logingoogle")
		return
	}
	log.Verbosef("redir: '%s'\n", redir)

	// login callback must be exactly as configured with Google so we can't
	// encode redir as url param the way we do for Twitter login
	// instead we'll encode redir inside state
	oauthCopy := oauthGoogleConf
	oauthCopy.RedirectURL = getMyHost(r) + "/logingooglecb"
	uri := oauthCopy.AuthCodeURL(oauthSecretPrefix+redir, oauth2.AccessTypeOnline)
	http.Redirect(w, r, uri, http.StatusTemporaryRedirect)
}

// url: GET /logout?redir=${redirect}
func handleLogout(w http.ResponseWriter, r *http.Request) {
	redir := strings.TrimSpace(r.FormValue("redir"))
	if redir == "" {
		log.Errorf("Missing 'redir' arg for /logout\n")
		redir = "/"
	}
	log.Verbosef("redir: '%s'\n", redir)
	deleteSecureCookie(w)
	http.Redirect(w, r, redir, http.StatusTemporaryRedirect)
}
