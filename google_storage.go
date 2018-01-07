package main

import (
	"context"
	"fmt"
	"io/ioutil"
	"time"

	"github.com/kjk/quicknotes/pkg/log"
	"github.com/kjk/u"

	"cloud.google.com/go/storage"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

const (
	quicknotesBucket = "quicknotes"
)

var (
	googleStorageClient *storage.Client
	// if true, don't save notes to Google Storage. Enabled when running locally
	onlyLocalStorage bool
)

func loadGoogleStorageCredentialsMust() []byte {
	d, err := ioutil.ReadFile("credentials.json")
	u.PanicIfErr(err)
	return d
}

func initGoogleStorageMust() {
	// http://godoc.org/golang.org/x/oauth2/google
	// another way: https://godoc.org/google.golang.org/cloud/storage#example-package--Auth
	d := loadGoogleStorageCredentialsMust()
	conf, err := google.JWTConfigFromJSON(
		d,
		storage.ScopeReadWrite,
	)
	u.PanicIfErr(err, "google.JWTConfigFromJSON")
	ctx := context.Background()
	opt := option.WithTokenSource(conf.TokenSource(ctx))
	googleStorageClient, err = storage.NewClient(ctx, opt)
	u.PanicIfErr(err, "storage.NewClient")
}

func testListObjects() {
	ctx := context.Background()
	var query *storage.Query
	nTotal := 0
	timeStart := time.Now()

	it := googleStorageClient.Bucket(quicknotesBucket).Objects(ctx, query)
	for {
		_, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			log.Errorf("testListObjects: it.Next() failed with '%s'\n", err)
			break
		}
		nTotal++
		//log.Verbosef("%d objects\n", len(objects.Results))
		//for _, obj := range objects.Results {
		//	fmt.Printf("name: %s, size: %v\n", obj.Name, obj.Size)
		//}
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
