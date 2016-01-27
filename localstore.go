package main

import (
	"bytes"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/kjk/log"
	"github.com/kjk/u"
	"github.com/syndtr/goleveldb/leveldb"
)

/*
High-level overview:
- this is content-based storage, content is identified by sha1
- data is stored in a provided directory
- large files (>FileSizeSegmentThreshold) are stored in a file named by hex sha1
  of content in {dir}/{ab}/{cd}/{sha1} (where {ab} and {cd} are hex of first
  and second byte of 20-byte sha1
- to minimize the amount of created files we use segment files to store multiple
  files smaller than FileSizeSegmentThreshold in a single append-only segment file
- new segment files are created after exceeding size threshold (1GB by default)
- goleveldb database stores association of sha1 to a file path where the content
  is stored. For large files it's file path. For small files it's path to the
  segment file plus size and offset in segment file, in the form {path}:{offset}:{size}
*/

const (
	defaultMaxSegmentSize           = 1024 * 1024 * 1024 * 1 // 1 GB
	defaultFileSizeSegmentThreshold = 1024 * 1024 * 1        // 1 MB, bigger than this will be saved to a separate file
)

var (
	dbKeyPrefixSha1 = []byte("sha1:")
	// ErrInvalidSegmentFilePath describes an error about invalid segment file
	ErrInvalidSegmentFilePath = errors.New("invalid segment file path")
)

// LocalStore describes a store
type LocalStore struct {
	mu                  sync.Mutex
	dataDir             string
	filesDir            string
	db                  *leveldb.DB
	currSegmentFile     *os.File
	currSegmentFileName string
	currSegmentSize     int

	// can be changed right after NewLocalStore
	MaxSegmentSize           int
	FileSizeSegmentThreshold int
}

func closeFilePtr(filePtr **os.File) (err error) {
	f := *filePtr
	if f != nil {
		err = f.Close()
		*filePtr = nil
	}
	return err
}

// NewLocalStore creates a new store in a given directory
func NewLocalStore(dir string) (*LocalStore, error) {
	filesDir := filepath.Join(dir, "files")
	err := u.CreateDirIfNotExists(filesDir)
	dbDir := filepath.Join(dir, "db")
	db, err := leveldb.OpenFile(dbDir, nil)
	if err != nil {
		return nil, err
	}
	store := &LocalStore{
		db:                       db,
		dataDir:                  dir,
		filesDir:                 filesDir,
		MaxSegmentSize:           defaultMaxSegmentSize,
		FileSizeSegmentThreshold: defaultFileSizeSegmentThreshold,
	}
	return store, nil
}

func saveToFile(path string, d []byte) error {
	if u.PathExists(path) {
		return nil
	}
	err := u.CreateDirForFile(path)
	if err != nil {
		log.Errorf("u.CrewateDirForFile('%s') failed with %s\n", path, err)
		return err
	}
	return ioutil.WriteFile(path, d, 0644)
}

func fileNameForSha1(sha1 []byte) string {
	d1 := fmt.Sprintf("%02x", sha1[0])
	d2 := fmt.Sprintf("%02x", sha1[1])
	return filepath.Join(d1, d2, fmt.Sprintf("%x", sha1))
}

func (store *LocalStore) pathForSha1(sha1 []byte) string {
	return filepath.Join(store.filesDir, fileNameForSha1(sha1))
}

func getSegmentFileName(dir string, maxSegmentSize int) (string, error) {
	files, err := ioutil.ReadDir(dir)
	if err != nil {
		return "", err
	}
	maxSegmentFileNo := 0
	for _, fi := range files {
		if !fi.Mode().IsRegular() {
			continue
		}
		parts := strings.Split(fi.Name(), ".")
		if len(parts) != 3 {
			continue
		}
		if parts[0] != "segment" || parts[2] != "txt" {
			continue
		}
		log.Verbosef("found segment file: %s\n", fi.Name())
		if fi.Size() < int64(maxSegmentSize) {
			return fi.Name(), nil
		}
		n, err := strconv.Atoi(parts[1])
		if err != nil {
			log.Errorf("strconv.Atoi('%s') failed with %s\n", parts[1], err)
			continue
		}
		if n > maxSegmentFileNo {
			maxSegmentFileNo = n
		}
	}
	return fmt.Sprintf("segment.%d.txt", maxSegmentFileNo+1), nil
}

// returns name used to read the content back
func (store *LocalStore) saveToSegmentFile(d []byte) ([]byte, error) {
	if store.currSegmentFile == nil {
		segmentFileName, err := getSegmentFileName(store.filesDir, store.MaxSegmentSize)
		if err != nil {
			return nil, err
		}
		path := filepath.Join(store.filesDir, segmentFileName)
		if u.PathExists(path) {
			log.Verbosef("opening existing segment file %s\n", path)
			fi, err := os.Stat(path)
			if err != nil {
				log.Errorf("os.Stat('%s') failed with %s\n", path, err)
				return nil, err
			}
			f, err := os.OpenFile(path, os.O_WRONLY|os.O_APPEND, 0644)
			if err != nil {
				log.Errorf("os.OpenFile('%s') failed with %s\n", path, err)
				return nil, err
			}
			store.currSegmentFile = f
			store.currSegmentSize = int(fi.Size())
		} else {
			log.Verbosef("creating new segment file %s\n", path)
			f, err := os.Create(path)
			if err != nil {
				log.Errorf("os.Create('%s') failed with %s\n", path, err)
				return nil, err
			}
			store.currSegmentFile = f
			store.currSegmentSize = 0
		}
		store.currSegmentFileName = segmentFileName
	}

	offset := store.currSegmentSize
	size := len(d)

	n, err := store.currSegmentFile.Write(d)
	store.currSegmentSize += n
	if err != nil {
		log.Errorf("store.currSegmentFile.Write() failed with %s\n", err)
		return nil, err
	}
	err = store.currSegmentFile.Sync()
	if err != nil {
		log.Errorf("store.currSegmentFile.Sync() failed with %s\n", err)
		return nil, err
	}
	if store.currSegmentSize >= store.MaxSegmentSize {
		// this will trigger opening a new segment file on next save
		err := closeFilePtr(&store.currSegmentFile)
		if err != nil {
			log.Errorf("closeFilePtr() failed with %s\n", err)
		}
		log.Verbosef("closed segment file '%s' because reached size limit (%d > %d)\n", store.currSegmentFileName, store.currSegmentSize, store.MaxSegmentSize)
	}
	name := fmt.Sprintf("%s:%d:%d", store.currSegmentFileName, offset, size)
	return []byte(name), nil
}

func dbKey(keyPrefix, keySuffix []byte) []byte {
	key := make([]byte, 0, len(keyPrefix)+len(keySuffix))
	key = append(key, keyPrefix...)
	return append(key, keySuffix...)
}

func dbKeyForContentSha1(sha1 []byte) []byte {
	return dbKey(dbKeyPrefixSha1, sha1)
}

// PutContent returns sha1 of d
func (store *LocalStore) PutContent(d []byte) ([]byte, error) {
	sha1 := u.Sha1OfBytes(d)
	var val []byte
	size := len(d)

	key := dbKeyForContentSha1(sha1)
	has, err := store.db.Has(key, nil)
	if err == nil && has {
		return sha1, nil
	}
	store.mu.Lock()
	defer store.mu.Unlock()

	if size > store.FileSizeSegmentThreshold {
		err := saveToFile(store.pathForSha1(sha1), d)
		if err != nil {
			return nil, err
		}
		val = []byte(fileNameForSha1(sha1))
	} else {
		val, err = store.saveToSegmentFile(d)
		if err != nil {
			return nil, err
		}
	}
	err = store.db.Put(key, val, nil)
	if err != nil {
		return nil, err
	}
	return sha1, nil
}

// GetSnippet reads snippet from the database
func (store *LocalStore) GetSnippet(sha1Content []byte) ([]byte, error) {
	return store.getContentBySha1Limited(sha1Content, snippetSizeThreshold)
}

func readFromFile(file *os.File, offset, size int) ([]byte, error) {
	res := make([]byte, size, size)
	if _, err := file.ReadAt(res, int64(offset)); err != nil {
		return nil, err
	}
	return res, nil
}

func readFromFilePath(path string, offset, size int) ([]byte, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return readFromFile(f, offset, size)
}

// TODO: could cache N fds to segment file to save the cost of opening the file
// not sure if that's important
func (store *LocalStore) readFromSegmentFileLimited(fileName string, limit int) ([]byte, error) {
	parts := strings.Split(fileName, ":")
	if len(parts) != 3 {
		log.Errorf("invalid segment file path '%s'\n", fileName)
		return nil, ErrInvalidSegmentFilePath
	}
	fileName = parts[0]
	offset, err := strconv.Atoi(parts[1])
	if err != nil {
		log.Errorf("invalid offset '%s' in segment file path '%s'\n", parts[1], fileName)
		return nil, ErrInvalidSegmentFilePath
	}
	size, err := strconv.Atoi(parts[2])
	if err != nil {
		log.Errorf("invalid size '%s' in segment file path '%s'\n", parts[1], fileName)
		return nil, ErrInvalidSegmentFilePath
	}
	path := filepath.Join(store.filesDir, fileName)
	if limit != -1 && size > limit {
		size = limit
	}
	return readFromFilePath(path, offset, size)
}

func (store *LocalStore) getContentBySha1Limited(sha1 []byte, limit int) ([]byte, error) {
	key := dbKeyForContentSha1(sha1)
	name, err := store.db.Get(key, nil)
	if err != nil {
		return nil, err
	}
	fileName := string(name)
	if strings.HasPrefix(fileName, "segment.") {
		return store.readFromSegmentFileLimited(fileName, limit)
	}
	path := store.pathForSha1(sha1)
	if -1 == limit {
		return ioutil.ReadFile(path)
	}
	return readFileLimited(path, limit)
}

// GetContentBySha1 reads the content by sha1
func (store *LocalStore) GetContentBySha1(sha1 []byte) ([]byte, error) {
	return store.getContentBySha1Limited(sha1, -1)
}

// Close closes the store
func (store *LocalStore) Close() {
	if store.db != nil {
		store.db.Close()
		store.db = nil
	}
	closeFilePtr(&store.currSegmentFile)
}

func readFileLimited(path string, limit int) ([]byte, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	n := int64(limit)

	if fi, err := f.Stat(); err == nil {
		// Don't preallocate a huge buffer, just in case.
		if size := fi.Size(); size < n {
			n = size
		}
	}

	buf := bytes.NewBuffer(make([]byte, 0, n))
	_, err = buf.ReadFrom(f)
	return buf.Bytes(), err
}
