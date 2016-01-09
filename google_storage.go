package main

import (
	"fmt"
	"io/ioutil"
	"time"

	"github.com/kjk/log"

	"golang.org/x/net/context"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"golang.org/x/oauth2/jwt"
	"google.golang.org/cloud"
	"google.golang.org/cloud/storage"
)

const (
	notenikBucket = "notenik"
)

var (
	googleStorageContext *context.Context
	// if true, don't save notes to Google Storage. Enabled when running locally
	onlyLocalStorage bool
)

func getGoogleStorageContext() context.Context {
	if googleStorageContext != nil {
		return *googleStorageContext
	}

	// http://godoc.org/golang.org/x/oauth2/google
	// another way: https://godoc.org/google.golang.org/cloud/storage#example-package--Auth
	conf := &jwt.Config{
		Email: "393285548407-rjg92t57mb9o85p66b0bbavbpa045a9n@developer.gserviceaccount.com",
		PrivateKey: []byte(`-----BEGIN RSA PRIVATE KEY-----
MIICXgIBAAKBgQDmMgMbAc60qjyYJmPuqg/TvS3L1pXtau7X2nJIvd+hJgR0WMFe
1c9WHBpI6pRDPgi2MDOPfgapFeTR32B395Y6vpoSBU+uHfCQW5vm37qu11QHq/s6
GK08Z5K6r3mioRToAgtYtd1nlbZgW7L+Vn+FHeaINqSN1Hs084+QrbdsjwIDAQAB
AoGBALIPYYOUhFYPkMuIdqh4d8Grhi80j8iUfKgPW3OVG9TFWZC9zuYSsUzEdDiO
65yP8aEr69ZE/9XvD46gITjrFRJoJHFcNoTx7PKJHtKKdNTjxLYECdCZ8mYn9Top
/w4nNev5DSATweYf2FOOZrjXgDhvdKubY8YQvY0R/yJzDgOhAkEA9ZK+Ae5IcH2B
AMAvO2fVOnwNzAnwoYVt850ejoU7weREELL5Xtd/oiwemJhNUDbu8X+OFPDvVNop
iUabf2nQaQJBAO/4HtBtcL6jzziDFUVT9EiDIO1OMSLeE8lQ6V2twL0Xt9rL/989
SLBLELvkP0oWnPEkHGZnWRw38mZ0xLsptjcCQAwqtA1GcAJaxXxzCSQJVfAq20gj
qe9mu/bY7v2irj5B//lP1LkVNjajtvRaf2IdBqOibTiuYz0x/eLWQ7gBVxkCQQDY
Cm/jgcPxPhT/cbQiuFTDO5rXSoAePgVeR0PyHM3a75GMoAB6gPgCD3K/VdxM3VLq
HnKbFww4xX2sFBBR2Fm9AkEAm+Qv+QFOw5rRDhG1M78QDpFYuqxDkUSU7ojDFKuG
uU0geujcQuO125xyqvI7C8JzozWtMwlNwMAR0tFETlPQFQ==
-----END RSA PRIVATE KEY-----`),
		Scopes: []string{
			storage.ScopeReadWrite,
		},
		TokenURL: google.JWTTokenURL,
	}
	client := conf.Client(oauth2.NoContext)
	ctx := cloud.NewContext("practical-truck-801", client)
	googleStorageContext = &ctx
	return *googleStorageContext
}

func testListObjects() {
	ctx := getGoogleStorageContext()
	var query *storage.Query
	nTotal := 0
	timeStart := time.Now()
	for {
		objects, err := storage.ListObjects(ctx, notenikBucket, query)
		if err != nil {
			log.Errorf("storage.ListObjects() failed with %s\n", err)
			return
		}
		//log.Infof("%d objects\n", len(objects.Results))
		//for _, obj := range objects.Results {
		//	fmt.Printf("name: %s, size: %v\n", obj.Name, obj.Size)
		//}
		nTotal += len(objects.Results)
		query = objects.Next
		if query == nil {
			break
		}
	}
	log.Infof("listed %d objects in %s\n", nTotal, time.Since(timeStart))
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
	ctx := getGoogleStorageContext()
	_, err := storage.StatObject(ctx, notenikBucket, path)
	if err == nil {
		// alreadyexists
		return nil
	}
	if err != nil {
		if err != storage.ErrObjectNotExist {
			log.Errorf("storage.StatObject('%s') failed with %s", path, err)
			return err
		}
	}
	w := storage.NewWriter(ctx, notenikBucket, path)
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
	ctx := getGoogleStorageContext()

	r, err := storage.NewReader(ctx, notenikBucket, path)
	if err != nil {
		return nil, err
	}
	d, err := ioutil.ReadAll(r)
	r.Close()
	if err != nil {
		return nil, err
	}
	log.Infof("downloaded %s from google storage in %s\n", path, time.Since(timeStart))
	return d, nil
}
