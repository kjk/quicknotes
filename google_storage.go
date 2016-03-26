package main

import (
	"fmt"
	"io/ioutil"
	"time"

	"github.com/kjk/log"

	"golang.org/x/net/context"
	"golang.org/x/oauth2/google"
	"google.golang.org/cloud"
	"google.golang.org/cloud/storage"
)

const (
	quicknotesBucket = "quicknotes"
	credentialsJSON  = `{
  "type": "service_account",
  "project_id": "practical-truck-801",
  "private_key_id": "8ee33f44d90312e8acacda70bbf7fbea98bed414",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDfcYt5sIhuUOHh\nYzcnh7nsq0iiaeJtaEqdWMPt1w7BDTHBEYKyly/2dYUHyxCvu9GwjbADBkXyu1nF\n7lSPHvVrPfdOt9DlNRfu60rqVCJ50IzFsXKopuG1q7MzdCZCHnf1rrGEOeGuUhBQ\nYRsNOrZjSmObs7rGGEXNKqaln9XubaCm1VIaUTS8yNXLuru6OQw/ssJ57JN9+4a4\nUaQY5XjXSjOi+HDxJduXIMUji/fDnkkksJluZEUlBEgZwQrdW9MduanV8/h4L5jz\nXQCE/mCzvtYcGGnTdeVm94U0e/mEpDr0pzp+pPKMxRabdTmwK+sqS7e5kYEgwnDJ\nJIh2obZHAgMBAAECggEBAIVuaLvij5ZQ9pKBjQ4uHvkVz+otEOoEvYn42AfPxR/D\noVKKAmJjpmCnDSn6OZy3rCCie9lShbLN7m4kRJqzAhtohaacXkKB0ij6mWIVnADi\naS4lKTNNdLvoLLstQSt6xmgQSjGL3xkaKGPXmS/tP71LTvBMA90H4acDMUD2keou\nr2vAESN9uocB4zt7zF85Mz7TIkPgxdeyOQeaoOOTxH2saTCHrJebWDMZVfCUxEuS\nnyv27278BbqIHk5wRFVl75hyBc6Vo4d/rHawacXl0Zx4uSNtBilFNo0PURnbneLm\n+6PcBrNpn6wIX2VwPGFj76SWTC9tP9DOnJ7T7h4IHQECgYEA9CJQLflsaOWoK32/\nc0DbfLvJvtIMANxy46hZlgsZX7hvGr8ZFlQ3RmFrBFKRPrLux+zVcgYZMgCUwozk\n2j9yseGHy3fWQs5pXD3r1ncawCcEuYliF67Hgsnlrt00edAVkLP7ZWlWohThctk5\n/D5Nvxob00Q2sX2WuAJdK1Imt4MCgYEA6k3JMN+yknSPieCDSmP6bkkMl37Uk++p\nma7ssixusCLuhOuBzl9W7klFf3F1dT4q7x8C9IDrEfK8Y7Oy1LAN8A4iLlMNQ5oN\n515igj3uW6sC0GfC0UPLsP1RsTslpI44OZEa6bR+H8OcZUpluGkTBN1Ie40NDZv1\noQkGfoQ0Ru0CgYARvEBo5prKkAyEhFEZNVf8msPQOgAnO9yYz00aylmgi4x+u+09\nowaU9VTJ7pmgnW0dVwY2j1zbNhGYhJXHiR5y77hmvqDxH3+l9NWiMerelLcSJ3nZ\n0Jer17D44BcE1moKphiYSGvDwJKUPlWpDnmlbWciFO2IPWBqo7lTAVfQswKBgDZA\nsrBda9TbpozvbpcgFVHKGl9N390tZmEOjwImpa6lOAORIKpviwp77tq2o9L1BS3/\nSUjiPQwX36Vaa7Mx3NhT/XgqhOy9VDDZuwebXYDeVTV6gTLBdv3RekQGhQ3YXI5/\n2fJ5d6bVPXZ6xpjvw5ahwnHRVE9taG/UTiunYw91AoGAbVWgvU9occo/940QuNMN\nkNyDyoUt6VZR+ZMTxGzT5P2JMXwFRPuV3P6hyM/tu7OQoWoZHbHTFeLLJpHe7VqZ\nYVKN3iaq/px0bafL6Db4RIbuHV6eAO2bK+2AIrXA4S6ih5ow1h4GpQdWf2SE0etn\nybXfeYPDOZVISk8hLUEvOR4=\n-----END PRIVATE KEY-----\n",
  "client_email": "service-account-2@practical-truck-801.iam.gserviceaccount.com",
  "client_id": "109176300735941648760",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://accounts.google.com/o/oauth2/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/service-account-2%40practical-truck-801.iam.gserviceaccount.com"
}`
)

var (
	googleStorageClient *storage.Client
	// if true, don't save notes to Google Storage. Enabled when running locally
	onlyLocalStorage bool
)

func initGoogleStorageMust() {
	// http://godoc.org/golang.org/x/oauth2/google
	// another way: https://godoc.org/google.golang.org/cloud/storage#example-package--Auth
	conf, err := google.JWTConfigFromJSON(
		[]byte(credentialsJSON),
		storage.ScopeReadWrite,
	)
	fatalIfErr(err, "google.JWTConfigFromJSON")
	ctx := context.Background()
	opt := cloud.WithTokenSource(conf.TokenSource(ctx))
	googleStorageClient, err = storage.NewClient(ctx, opt)
	fatalIfErr(err, "storage.NewClient")
}

func testListObjects() {
	ctx := context.Background()
	var query *storage.Query
	nTotal := 0
	timeStart := time.Now()
	for {
		objects, err := googleStorageClient.Bucket(quicknotesBucket).List(ctx, query)
		if err != nil {
			log.Errorf("storage.ListObjects() failed with %s\n", err)
			return
		}
		//log.Verbosef("%d objects\n", len(objects.Results))
		//for _, obj := range objects.Results {
		//	fmt.Printf("name: %s, size: %v\n", obj.Name, obj.Size)
		//}
		nTotal += len(objects.Results)
		query = objects.Next
		if query == nil {
			break
		}
	}
	log.Verbosef("listed %d objects in %s\n", nTotal, time.Since(timeStart))
}

func noteGoogleStoragePath(sha1 []byte) string {
	return fmt.Sprintf("notes_sha1/%02x/%02x/%02x/%x", sha1[0], sha1[1], sha1[2], sha1)
}

// TODO: remember timing of requests somewhere for analysis
func saveNoteToGoogleStorage(sha1 []byte, d []byte) error {
	if onlyLocalStorage {
		return nil
	}
	timeStart := time.Now()
	path := noteGoogleStoragePath(sha1)
	ctx := context.Background()
	objHandle := googleStorageClient.Bucket(quicknotesBucket).Object(path)
	_, err := objHandle.Attrs(ctx)
	if err == nil {
		// already exists
		return nil
	}
	if err != nil {
		if err != storage.ErrObjectNotExist {
			log.Errorf("storage.Attrs('%s') failed with %s", path, err)
			return err
		}
	}
	w := objHandle.NewWriter(ctx)
	w.ContentType = "text/plain"
	_, err = w.Write(d)
	if err != nil {
		log.Errorf("w.Write() failed with %s\n", err)
	}
	err2 := w.Close()
	if err2 != nil {
		log.Errorf("w.Close() failed with %s\n", err2)
	}
	if err != nil {
		return err
	}
	if err2 != nil {
		return err2
	}
	log.Verbosef("saved %d bytes in %s, file: '%s'\n", len(d), time.Since(timeStart), path)
	return nil
}

func readNoteFromGoogleStorage(sha1 []byte) ([]byte, error) {
	timeStart := time.Now()
	path := noteGoogleStoragePath(sha1)
	ctx := context.Background()
	objHandle := googleStorageClient.Bucket(quicknotesBucket).Object(path)
	r, err := objHandle.NewReader(ctx)
	if err != nil {
		return nil, err
	}
	d, err := ioutil.ReadAll(r)
	r.Close()
	if err != nil {
		return nil, err
	}
	log.Verbosef("downloaded %s from google storage in %s\n", path, time.Since(timeStart))
	return d, nil
}
