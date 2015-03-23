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
	"github.com/kjk/u"
	"golang.org/x/oauth2"
)

const (
	cookieAuthKeyHexStr = "513521f0ef43c9446ed7bf359a5a9700ef5fa5a5eb15d0db5eae8e93856d99bd"
	cookieEncrKeyHexStr = "4040ed16d4352320b5a7f51e26443342d55a0f46be2acfe5ba694a123230376a"
	cookieName          = "qnckie" // "quicknotes cookie"
)

var (
	cookieAuthKey []byte
	cookieEncrKey []byte

	secureCookie *securecookie.SecureCookie

	// random string for oauth2 API calls to protect against CSRF
	oauthSecretString = "5576867039"

	githubEndpoint = oauth2.Endpoint{
		AuthURL:  "https://github.com/login/oauth/authorize",
		TokenURL: "https://github.com/login/oauth/access_token",
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

	secretsMutex sync.Mutex
	tempSecrets  = map[string]string{}
)

// SecureCookieValue is value of the cookie
type SecureCookieValue struct {
	UserID int
}

func initCookieMust() {
	var err error
	cookieAuthKey, err = hex.DecodeString(cookieAuthKeyHexStr)
	u.PanicIfErr(err)
	cookieEncrKey, err = hex.DecodeString(cookieEncrKeyHexStr)
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
		LogErrorf("secureCookie.Decode() failed with %s\n", err)
		deleteSecureCookie(w)
		return nil
	}
	fmt.Printf("Got cookie %#v\n", ret)
	return &ret
}

func getUserFromCookie(w http.ResponseWriter, r *http.Request) *DbUser {
	sc := getSecureCookie(w, r)
	if sc == nil {
		return nil
	}
	user, err := dbGetUserByID(sc.UserID)
	if err != nil {
		LogErrorf("dbGetUserById(%d) failed with %s\n", sc.UserID, err)
		return nil
	}
	return user
}

func putTempCredentials(cred *oauth.Credentials) {
	secretsMutex.Lock()
	defer secretsMutex.Unlock()
	tempSecrets[cred.Token] = cred.Secret
}

func getTempCredentials(token string) *oauth.Credentials {
	secretsMutex.Lock()
	defer secretsMutex.Unlock()
	if secret, ok := tempSecrets[token]; ok {
		return &oauth.Credentials{Token: token, Secret: secret}
	}
	return nil
}

func deleteTempCredentials(token string) {
	secretsMutex.Lock()
	defer secretsMutex.Unlock()
	delete(tempSecrets, token)
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

// url: GET /logintwittercb?redirect=${redirect}
func handleOauthTwitterCallback(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("handleOauthTwitterCallback() url: '%s'\n", r.URL)
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
		LogErrorf("no 'screen_name' in %#v\n", info)
		// TODO: show error to the user
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}

	fullName, _ := info["name"].(string)
	// also might be useful:
	// email
	// avatar_url
	userHandle := "twitter:" + twitterHandle
	user, err := dbGetOrCreateUser(userHandle, fullName)
	if err != nil {
		LogErrorf("dbGetOrCreateUser('%s', '%s') failed with '%s'\n", userHandle, fullName, err)
		// TODO: show error to the user
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}
	LogInfof("created user %d with handle '%s'\n", user.ID, userHandle)
	cookieVal := &SecureCookieValue{
		UserID: user.ID,
	}
	setSecureCookie(w, cookieVal)
	// TODO: dbUserSetTwitterOauth(user, tokenCredJson)
	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}

// url: GET /logintwitter?redirect=${redirect}
func handleLoginTwitter(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("handleLoginTwitter() url: '%s'\n", r.URL)

	redirect := strings.TrimSpace(r.FormValue("redirect"))
	if redirect == "" {
		httpErrorf(w, "Missing redirect value for /logintwitter")
		return
	}

	q := url.Values{
		"redirect": {redirect},
	}.Encode()
	cb := "http://" + r.Host + "/logintwittercb?" + q

	tempCred, err := oauthTwitterClient.RequestTemporaryCredentials(nil, cb, nil)
	if err != nil {
		httpErrorf(w, "oauthTwitterClient.RequestTemporaryCredentials() failed with '%s'", err)
		return
	}
	putTempCredentials(tempCred)
	http.Redirect(w, r, oauthTwitterClient.AuthorizationURL(tempCred, nil), 302)
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

// logingithubcb?redirect
func handleOauthGitHubCallback(w http.ResponseWriter, r *http.Request) {
	state := r.FormValue("state")
	if state != oauthSecretString {
		LogErrorf("invalid oauth state, expected '%s', got '%s'\n", oauthSecretString, state)
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}

	code := r.FormValue("code")
	token, err := oauthGitHubConf.Exchange(oauth2.NoContext, code)
	if err != nil {
		LogErrorf("oauthGitHubConf.Exchange() failed with '%s'\n", err)
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}

	oauthClient := oauthGitHubConf.Client(oauth2.NoContext, token)
	client := github.NewClient(oauthClient)
	user, _, err := client.Users.Get("")
	if err != nil {
		LogErrorf("client.Users.Get() faled with '%s'\n", err)
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}
	LogInfof("Logged in as GitHub user: %s\n", *user.Login)
	githubLogin := *user.Login
	fullName := *user.Name

	// also might be useful:
	// profile_image_url
	// profile_image_url_https
	userLogin := "github:" + githubLogin
	dbUser, err := dbGetOrCreateUser(userLogin, fullName)
	if err != nil {
		LogErrorf("dbGetOrCreateUser('%s', '%s') failed with '%s'\n", userLogin, fullName, err)
		// TODO: show error to the user
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}
	LogInfof("created user %d with login '%s' and handle '%s'\n", dbUser.ID, dbUser.Login.String, dbUser.Handle.String)
	cookieVal := &SecureCookieValue{
		UserID: dbUser.ID,
	}
	setSecureCookie(w, cookieVal)
	// TODO: dbUserSetGithubOauth(user, tokenCredJson)
	http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
}

// /logingithub?redirect=${redirect}
func handleLoginGitHub(w http.ResponseWriter, r *http.Request) {
	redirect := strings.TrimSpace(r.FormValue("redirect"))
	if redirect == "" {
		httpErrorf(w, "Missing redirect value for /logintwitter")
		return
	}
	uri := oauthGitHubConf.AuthCodeURL(oauthSecretString, oauth2.AccessTypeOnline)
	http.Redirect(w, r, uri, http.StatusTemporaryRedirect)
}

// url: GET /logout?redirect=${redirect}
func handleLogout(w http.ResponseWriter, r *http.Request) {
	redirect := strings.TrimSpace(r.FormValue("redirect"))
	if redirect == "" {
		LogErrorf("Missing redirect value for /logout\n")
		redirect = "/"
	}
	deleteSecureCookie(w)
	http.Redirect(w, r, redirect, 302)
}
