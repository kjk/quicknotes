package main

import (
	"bytes"
	"database/sql"
	"errors"
	"fmt"
	"io/ioutil"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/kjk/log"
)

// TODO: use prepared statements where possible

const (
	tagsSepByte                 = 30          // record separator
	snippetSizeThreshold        = 1024        // 1 KB
	cachedContentSizeThresholed = 1024 * 1024 // 1 MB
)

// must match Note.js
const (
	formatText       = "txt"
	formatMarkdown   = "md"
	formatHTML       = "html"
	formatCodePrefix = "code:"
)

// DbUser.ProState
const (
	NotProEligible = iota
	CanBePro
	IsPro
)

var (
	formatNames         = []string{formatText, formatMarkdown, formatHTML, formatCodePrefix}
	sqlDb               *sql.DB
	sqlDbMu             sync.Mutex
	tagSepStr           = string([]byte{30})
	userIDToCachedInfo  map[int]*CachedUserInfo
	contentCache        map[string]*CachedContentInfo
	userIDToDbUserCache map[int]*DbUser

	// general purpose mutex for short-lived ops (like lookup/insert in a map)
	mu sync.Mutex
)

func init() {
	userIDToCachedInfo = make(map[int]*CachedUserInfo)
	contentCache = make(map[string]*CachedContentInfo)
	userIDToDbUserCache = make(map[int]*DbUser)
}

func getSQLConnectionRoot() string {
	if isLocal() && !flgProdDb {
		//return "root@tcp(localhost:3306)/"
		return fmt.Sprintf("root:7UgJnRvp39vW@tcp(%s:%s)/", flgDbHost, flgDbPort)
	}
	return "root:7UgJnRvp39vW@tcp(138.68.248.213:3306)/"
}

func getSQLConnection() string {
	return getSQLConnectionRoot() + "quicknotes?parseTime=true"
}

func isValidFormat(s string) bool {
	if strings.HasPrefix(s, formatCodePrefix) {
		return true
	}
	for _, fn := range formatNames {
		if fn == s {
			return true
		}
	}
	return false
}

// CachedContentInfo is content with time when it was cached
type CachedContentInfo struct {
	lastAccessTime time.Time
	d              []byte
}

// DbUser is an information about the user
type DbUser struct {
	ID int
	// TODO: less use of sql.NullString
	Login     string         // e.g. 'google:kkowalczyk@gmail'
	FullName  sql.NullString // e.g. 'Krzysztof Kowalczyk'
	ProState  int
	Email     sql.NullString
	OauthJSON sql.NullString
	CreatedAt time.Time

	handle string // e.g. 'kjk'
}

// GetHandle returns short user handle extracted from login
// "twitter:kjk" => "kjk"
func (u *DbUser) GetHandle() string {
	if len(u.handle) > 0 {
		return u.handle
	}
	parts := strings.SplitN(u.Login, ":", 2)
	if len(parts) != 2 {
		log.Errorf("invalid login '%s'\n", u.Login)
		return ""
	}
	handle := parts[1]
	// if this is an e-mail like kkowalczyk@gmail.com, only return
	// the part before e-mail
	parts = strings.SplitN(handle, "@", 2)
	if len(parts) == 2 {
		handle = parts[0]
	}
	return handle
}

// DbNote describes note in database
type DbNote struct {
	id            int
	userID        int
	CurrVersionID int
	IsDeleted     bool
	IsPublic      bool
	IsStarred     bool
	Size          int
	Title         string
	Format        string
	ContentSha1   []byte
	Tags          []string `json:",omitempty"`
	CreatedAt     time.Time
}

// Note describes note in memory
type Note struct {
	DbNote
	UpdatedAt   time.Time
	Snippet     string
	IsPartial   bool
	IsTruncated bool
	HashID      string
}

// NewNote describes a new note to be inserted into a database
type NewNote struct {
	hashID      string
	title       string
	format      string
	content     []byte
	tags        []string
	createdAt   time.Time
	isDeleted   bool
	isPublic    bool
	isStarred   bool
	contentSha1 []byte
}

func newNoteFromNote(n *Note) (*NewNote, error) {
	var err error
	nn := &NewNote{
		title:       n.Title,
		format:      n.Format,
		tags:        n.Tags,
		createdAt:   n.CreatedAt,
		isDeleted:   n.IsDeleted,
		isPublic:    n.IsPublic,
		isStarred:   n.IsStarred,
		contentSha1: n.ContentSha1,
	}
	nn.content, err = getCachedContent(nn.contentSha1)
	return nn, err
}

// CachedUserInfo has cached user info
type CachedUserInfo struct {
	user          *DbUser
	notes         []*Note
	latestVersion int
}

type notesByCreatedAt []*Note

func (s notesByCreatedAt) Len() int {
	return len(s)
}
func (s notesByCreatedAt) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}
func (s notesByCreatedAt) Less(i, j int) bool {
	return s[i].CreatedAt.After(s[j].CreatedAt)
}

// SetSnippet sets a short version of note (if is big)
func (n *Note) SetSnippet() {
	var snippetBytes []byte
	// skip if we've already calculated it
	if n.Snippet != "" {
		return
	}

	snippet, err := localStore.GetSnippet(n.ContentSha1)
	if err != nil {
		return
	}
	// TODO: make this trimming when we create snippet sha1
	snippetBytes, n.IsTruncated = getShortSnippet(snippet)
	n.Snippet = strings.TrimSpace(string(snippetBytes))
	//log.Verbosef("note: %d, snippet size: %d\n", n.Id, len(n.CachedSnippet))
}

// SetCalculatedProperties calculates some props
func (n *Note) SetCalculatedProperties() {
	n.IsPartial = n.Size > snippetSizeThreshold
	n.HashID = hashInt(n.id)
	n.SetSnippet()
}

// Content returns note content
func (n *Note) Content() string {
	content, err := getNoteContent(n)
	if err != nil {
		return ""
	}
	return string(content)
}

func getCachedContent(sha1 []byte) ([]byte, error) {
	k := string(sha1)
	mu.Lock()
	i := contentCache[k]
	if i != nil {
		i.lastAccessTime = time.Now()
	}
	mu.Unlock()
	if i != nil {
		return i.d, nil
	}
	d, err := localStore.GetContentBySha1(sha1)
	if err != nil {
		return nil, err
	}
	mu.Lock()
	// TODO: cache eviction
	contentCache[k] = &CachedContentInfo{
		lastAccessTime: time.Now(),
		d:              d,
	}
	mu.Unlock()
	return d, nil
}

func getNoteContent(note *Note) ([]byte, error) {
	return getCachedContent(note.ContentSha1)
}

func clearCachedUserInfo(userID int) {
	mu.Lock()
	delete(userIDToCachedInfo, userID)
	mu.Unlock()
}

// TODO: a probably more robust way would be
// q := `select id from versions where user_id=$1 order by id desc limit 1;`
// but we would need user_id on versions table
func findLatestVersion(notes []*Note) int {
	id := 0
	for _, note := range notes {
		if note.CurrVersionID > id {
			id = note.CurrVersionID
		}
	}
	return id
}

func getCachedUserInfo(userID int) (*CachedUserInfo, error) {
	mu.Lock()
	i := userIDToCachedInfo[userID]
	mu.Unlock()

	if i != nil {
		return i, nil
	}
	timeStart := time.Now()
	user, err := dbGetUserByIDCached(userID)
	if user == nil {
		return nil, err
	}
	notes, err := dbGetNotesForUser(user)
	if err != nil {
		return nil, err
	}
	sort.Sort(notesByCreatedAt(notes))
	res := &CachedUserInfo{
		user:          user,
		notes:         notes,
		latestVersion: findLatestVersion(notes),
	}

	mu.Lock()
	userIDToCachedInfo[userID] = res
	mu.Unlock()
	log.Verbosef("took %s for user '%d'\n", time.Since(timeStart), userID)
	return res, nil
}

func execMust(db *sql.DB, q string, args ...interface{}) {
	log.Verbosef("db.Exec(): %s\n", q)
	_, err := db.Exec(q, args...)
	fatalIfErr(err, fmt.Sprintf("db.Exec('%s')", q))
}

func getCreateDbSQLMust() []byte {
	path := "createdb.sql"
	d := resourcesFromZip[path]
	if len(d) > 0 {
		return d
	}
	d, err := ioutil.ReadFile(path)
	fatalIfErr(err, "getCreateDbSqlMust")
	return d
}

func getCreateDbStatementsMust() []string {
	d := getCreateDbSQLMust()
	return dbSplitMultiStatements(string(d))
}

func dumpCreateDbStatements() {
	a := getCreateDbStatementsMust()
	for _, s := range a {
		fmt.Printf("%s\n\n", s)
	}
}

func createDatabaseMust() {
	log.Verbosef("trying to create the database\n")
	db, err := sql.Open("mysql", getSQLConnectionRoot())
	fatalIfErr(err, "sql.Open()")
	err = db.Ping()
	fatalIfErr(err, "db.Ping()")
	execMust(db, `CREATE DATABASE quicknotes CHARACTER SET utf8 COLLATE utf8_general_ci`)
	db.Close()

	db, err = getQuickNotesDb()
	fatalIfErr(err, "getQuickNotesDb()")
	stmts := getCreateDbStatementsMust()
	for _, stm := range stmts {
		execMust(db, stm)
	}
	db.Close()
	log.Verbosef("created quicknotes database\n")
}

func serializeTags(tags []string) string {
	if len(tags) == 0 {
		return ""
	}
	// in the very unlikely case
	for i, tag := range tags {
		tags[i] = strings.Replace(tag, tagSepStr, "", -1)
	}
	return strings.Join(tags, tagSepStr)
}

func deserializeTags(s string) []string {
	if len(s) == 0 {
		return nil
	}
	return strings.Split(s, tagSepStr)
}

// save to local store and google storage
// we only save snippets locally
func saveContent(d []byte) ([]byte, error) {
	sha1, err := localStore.PutContent(d)
	if err != nil {
		return nil, err
	}
	err = saveNoteToGoogleStorage(sha1, d)
	return sha1, err
}

func dbCreateNewNote(userID int, note *NewNote) (int, error) {
	db := getDbMust()
	tx, err := db.Begin()
	if err != nil {
		return 0, err
	}
	defer func() {
		if tx != nil {
			tx.Rollback()
		}
	}()

	fatalIf(note.contentSha1 == nil, "note.contentSha1 is nil")
	serializedTags := serializeTags(note.tags)

	// for non-imported notes use current time as note creation time
	if note.createdAt.IsZero() {
		note.createdAt = time.Now()
	}
	vals := NewDbVals("notes", 8)
	vals.Add("user_id", userID)
	vals.Add("curr_version_id", 0)
	vals.Add("versions_count", 1)
	vals.Add("created_at", note.createdAt)
	vals.Add("updated_at", note.createdAt)
	vals.Add("content_sha1", note.contentSha1)
	vals.Add("size", len(note.content))
	vals.Add("format", note.format)
	vals.Add("title", note.title)
	vals.Add("tags", serializedTags)
	vals.Add("is_deleted", note.isDeleted)
	vals.Add("is_public", note.isPublic)
	vals.Add("is_starred", false)
	vals.Add("is_encrypted", false)
	res, err := vals.TxInsert(tx)
	if err != nil {
		log.Errorf("tx.Exec('%s') failed with %s\n", vals.Query, err)
		return 0, err
	}

	noteID, err := res.LastInsertId()
	if err != nil {
		log.Errorf("res.LastInsertId() of noteID failed with %s\n", err)
		return 0, err
	}
	vals = NewDbVals("versions", 11)
	vals.Add("note_id", noteID)
	vals.Add("created_at", note.createdAt)
	vals.Add("content_sha1", note.contentSha1)
	vals.Add("size", len(note.content))
	vals.Add("format", note.format)
	vals.Add("title", note.title)
	vals.Add("tags", serializedTags)
	vals.Add("is_deleted", note.isDeleted)
	vals.Add("is_public", note.isPublic)
	vals.Add("is_starred", false)
	vals.Add("is_encrypted", false)
	res, err = vals.TxInsert(tx)
	if err != nil {
		log.Errorf("tx.Exec('%s') failed with %s\n", vals.Query, err)
		return 0, err
	}
	versionID, err := res.LastInsertId()
	if err != nil {
		log.Errorf("res.LastInsertId() of versionId failed with %s\n", err)
		return 0, err
	}
	q := `UPDATE notes SET curr_version_id=? WHERE id=?`
	_, err = tx.Exec(q, versionID, noteID)
	if err != nil {
		log.Errorf("tx.Exec('%s') failed with %s\n", q, err)
		return 0, err
	}
	err = tx.Commit()
	tx = nil
	return int(noteID), err
}

// most operations mark a note as updated except for starring, which is why
// we need markUpdated
func dbUpdateNote2(noteID int, note *NewNote, markUpdated bool) (int, error) {
	log.Verbosef("dbUpdateNote2: noteID: %d, markUpdated: %v\n", noteID, markUpdated)
	db := getDbMust()
	tx, err := db.Begin()
	if err != nil {
		return 0, err
	}
	defer func() {
		if tx != nil {
			log.Verbosef("dbUpdateNote2: noteID: %d, rolled back\n", noteID)
			tx.Rollback()
		}
	}()

	now := time.Now()
	if note.createdAt.IsZero() {
		note.createdAt = now
	}

	noteSize := len(note.content)

	serializedTags := serializeTags(note.tags)
	vals := NewDbVals("versions", 11)
	vals.Add("note_id", noteID)
	vals.Add("size", noteSize)
	vals.Add("created_at", now)
	vals.Add("content_sha1", note.contentSha1)
	vals.Add("format", note.format)
	vals.Add("title", note.title)
	vals.Add("tags", serializedTags)
	vals.Add("is_deleted", note.isDeleted)
	vals.Add("is_public", note.isPublic)
	vals.Add("is_starred", note.isStarred)
	vals.Add("is_encrypted", false)

	noteUpdatedAt := note.createdAt
	if markUpdated {
		noteUpdatedAt = now
	}
	res, err := vals.TxInsert(tx)
	if err != nil {
		log.Errorf("tx.Exec('%s') failed with %s\n", vals.Query, err)
		return 0, err
	}
	versionID, err := res.LastInsertId()
	if err != nil {
		log.Errorf("res.LastInsertId() of versionId failed with %s\n", err)
		return 0, err
	}
	log.Verbosef("inserting new version of note %d, new version id: %d\n", noteID, versionID)

	//Maybe: could get versions_count as:
	//q := `SELECT count(*) FROM versions WHERE note_id=?`
	q := `
UPDATE notes SET
  updated_at=?,
  content_sha1=?,
  size=?,
  format=?,
  title=?,
  tags=?,
  is_public=?,
  is_deleted=?,
  is_starred=?,
  curr_version_id=?,
  versions_count = versions_count + 1
WHERE id=?`
	_, err = tx.Exec(q,
		noteUpdatedAt,
		note.contentSha1,
		noteSize,
		note.format,
		note.title,
		serializedTags,
		note.isPublic,
		note.isDeleted,
		note.isStarred,
		versionID,
		noteID)
	if err != nil {
		log.Errorf("tx.Exec('%s') failed with %s\n", q, err)
		return 0, err
	}

	err = tx.Commit()
	tx = nil
	return int(noteID), err
}

func dbUpdateNoteWith(userID, noteID int, markUpdated bool, updateFn func(*NewNote) bool) error {
	log.Verbosef("dbUpdateNoteWith: userID=%s, noteID=%s, markUpdated: %v\n", hashInt(userID), hashInt(noteID), markUpdated)
	defer clearCachedUserInfo(userID)

	note, err := dbGetNoteByID(noteID)
	if err != nil {
		return err
	}
	if userID != note.userID {
		return fmt.Errorf("mismatched note user. noteID: %d, userID: %d, note.userID: %d", noteID, userID, note.userID)
	}
	newNote, err := newNoteFromNote(note)
	if err != nil {
		return err
	}
	log.Verbosef("dbUpdateNoteWith: note.IsStarred: %v, newNote.isStarred: %v\n", note.IsStarred, newNote.isStarred)

	shouldUpdate := updateFn(newNote)
	if !shouldUpdate {
		log.Verbosef("dbUpdateNoteWith: skipping update of noteID=%s because shouldUpdate=%v\n", hashInt(noteID), shouldUpdate)
		return nil
	}
	_, err = dbUpdateNote2(noteID, newNote, markUpdated)
	return err
}

func dbUpdateNoteTitle(userID, noteID int, newTitle string) error {
	return dbUpdateNoteWith(userID, noteID, true, func(newNote *NewNote) bool {
		shouldUpdate := newNote.title != newTitle
		newNote.title = newTitle
		return shouldUpdate
	})
}

func dbUpdateNoteTags(userID, noteID int, newTags []string) error {
	return dbUpdateNoteWith(userID, noteID, true, func(newNote *NewNote) bool {
		shouldUpdate := !strArrEqual(newNote.tags, newTags)
		newNote.tags = newTags
		return shouldUpdate
	})
}

func needsNewNoteVersion(note *NewNote, existingNote *Note) bool {
	if !bytes.Equal(note.contentSha1, existingNote.ContentSha1) {
		return true
	}
	if note.title != existingNote.Title {
		return true
	}
	if note.format != existingNote.Format {
		return true
	}
	if !strArrEqual(note.tags, existingNote.Tags) {
		return true
	}
	if note.isDeleted != existingNote.IsDeleted {
		return true
	}
	if note.isPublic != existingNote.IsPublic {
		return true
	}
	if note.isStarred != existingNote.IsStarred {
		return true
	}
	return false
}

func dbGetSelectCount(query string) (int, error) {
	db := getDbMust()
	n := 0
	err := db.QueryRow(query).Scan(&n)
	return n, err
}

func dbGetUsersCount() (int, error) {
	return dbGetSelectCount(`SELECT count(*) from users`)
}

func dbGetNotesCount() (int, error) {
	return dbGetSelectCount(`SELECT count(*) from notes`)
}

func dbGetVersionsCount() (int, error) {
	return dbGetSelectCount(`SELECT count(*) from versions`)
}

// create a new note. if note.createdAt is non-zero value, this is an import
// of note from somewhere else, so we want to preserve createdAt value
func dbCreateOrUpdateNote(userID int, note *NewNote) (int, error) {
	var err error
	if len(note.content) == 0 {
		return 0, errors.New("empty note content")
	}

	if !isValidFormat(note.format) {
		return 0, fmt.Errorf("invalid format %s", note.format)
	}

	note.contentSha1, err = saveContent(note.content)
	if err != nil {
		log.Errorf("saveContent() failed with %s\n", err)
		return 0, err
	}

	var noteID int
	if note.hashID == "" {
		noteID, err = dbCreateNewNote(userID, note)
		note.hashID = hashInt(noteID)
	} else {
		noteID, err := dehashInt(note.hashID)
		if err != nil {
			return 0, err
		}
		existingNote, err := dbGetNoteByID(noteID)
		if err != nil {
			return 0, err
		}
		if existingNote.userID != userID {
			return 0, fmt.Errorf("user %d is trying to update note that belongs to user %d", userID, existingNote.userID)
		}
		// when editing a note, we don't change starred status
		note.isStarred = existingNote.IsStarred
		// don't create new versions if not necessary
		if !needsNewNoteVersion(note, existingNote) {
			return noteID, nil
		}
		noteID, err = dbUpdateNote2(noteID, note, true)
	}

	clearCachedUserInfo(userID)
	return noteID, err
}

// TODO: also get content_sha1 for each version (requires index on content_sha1
// to be fast) and if this content_sha1 is only referenced by one version,
// delete from google storage
func dbPermanentDeleteNote(userID, noteID int) error {
	defer clearCachedUserInfo(userID)
	db := getDbMust()
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if tx != nil {
			tx.Rollback()
		}
	}()
	q := `
DELETE FROM notes
WHERE id=?`
	_, err = db.Exec(q, noteID)
	if err != nil {
		return err
	}
	q = `
DELETE FROM versions
WHERE note_id=?`
	_, err = db.Exec(q, noteID)
	if err != nil {
		return err
	}
	tx = nil
	return nil
}

func dbDeleteNote(userID, noteID int) error {
	return dbUpdateNoteWith(userID, noteID, true, func(note *NewNote) bool {
		shouldUpdate := !note.isDeleted
		note.isDeleted = true
		return shouldUpdate
	})
}

func dbUndeleteNote(userID, noteID int) error {
	return dbUpdateNoteWith(userID, noteID, true, func(note *NewNote) bool {
		shouldUpdate := note.isDeleted
		note.isDeleted = false
		return shouldUpdate
	})
}

func dbMakeNotePublic(userID, noteID int) error {
	// log.Verbosef("dbMakeNotePublic: userID=%d, noteID=%d", userID, noteID)
	// note: doesn't update lastUpdate for stability of display
	return dbUpdateNoteWith(userID, noteID, false, func(note *NewNote) bool {
		shouldUpdate := !note.isPublic
		note.isPublic = true
		// log.Verbosef(" shouldUpdate=%v\n", shouldUpdate)
		return shouldUpdate
	})
}

func dbMakeNotePrivate(userID, noteID int) error {
	// log.Verbosef("dbMakeNotePrivate: userID: %d, noteID: %d\n", userID, noteID)
	// note: doesn't update lastUpdate for stability of display
	return dbUpdateNoteWith(userID, noteID, false, func(note *NewNote) bool {
		shouldUpdate := note.isPublic
		note.isPublic = false
		return shouldUpdate
	})
}

func dbStarNote(userID, noteID int) error {
	// note: doesn't update lastUpdate for stability of display
	return dbUpdateNoteWith(userID, noteID, false, func(note *NewNote) bool {
		log.Verbosef("dbStarNote: userID: %s, noteID: %s, isStarred: %v\n", hashInt(userID), hashInt(noteID), note.isStarred)
		shouldUpdate := !note.isStarred
		note.isStarred = true
		return shouldUpdate
	})
}

func dbUnstarNote(userID, noteID int) error {
	log.Verbosef("dbUnstarNote: userID: %d, noteID: %d\n", userID, noteID)
	// note: doesn't update lastUpdate for stability of display
	return dbUpdateNoteWith(userID, noteID, false, func(note *NewNote) bool {
		shouldUpdate := note.isStarred
		note.isStarred = false
		log.Verbosef("dbUnstarNote: shouldUpdate: %v\n", shouldUpdate)
		return shouldUpdate
	})
}

// note: only use locally for testing search, not in production
func dbGetAllNotes() ([]*Note, error) {
	log.Verbosef("dbGetAllNotes\n")
	var notes []*Note
	db := getDbMust()
	q := `
SELECT
	id,
	user_id,
	curr_version_id,
	is_deleted,
	is_public,
	is_starred,
	created_at,
	updated_at,
	size,
	format,
	title,
	content_sha1,
	tags
FROM notes
ORDER BY updated_at DESC
LIMIT 10000`
	rows, err := db.Query(q)
	if err != nil {
		log.Errorf("db.Query('%s') failed with %s\n", q, err)
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var n Note
		var tagsSerialized string
		err = rows.Scan(
			&n.id,
			&n.userID,
			&n.CurrVersionID,
			&n.IsDeleted,
			&n.IsPublic,
			&n.IsStarred,
			&n.CreatedAt,
			&n.UpdatedAt,
			&n.Size,
			&n.Format,
			&n.Title,
			&n.ContentSha1,
			&tagsSerialized)
		if err != nil {
			return nil, err
		}
		n.Tags = deserializeTags(tagsSerialized)
		n.SetCalculatedProperties()
		notes = append(notes, &n)
	}
	err = rows.Err()
	if err != nil {
		log.Errorf("rows.Err() for '%s' failed with %s\n", q, err)
		return nil, err
	}
	return notes, nil
}

func dbGetAllVersionsSha1ForUser(userID int) ([][]byte, error) {
	db := getDbMust()
	q := `
SELECT content_sha1
FROM versions
WHERE id IN
  (SELECT id FROM notes WHERE user_id = ?);
`
	rows, err := db.Query(q, userID)
	if err != nil {
		log.Errorf("db.Query('%s') failed with %s\n", q, err)
		return nil, err
	}
	var res [][]byte
	defer rows.Close()
	for rows.Next() {
		var sha1 []byte
		err = rows.Scan(&sha1)
		if err != nil {
			log.Errorf("rows.Scan() failed with '%s'\n", err)
			return nil, err
		}
		if len(sha1) != 20 {
			log.Errorf("content_sha1 is %d bytes, should be 20\n", len(sha1))
			return nil, fmt.Errorf("content_sha1 is %d bytes (should be 20)", len(sha1))
		}
		res = append(res, sha1)
	}
	err = rows.Err()
	if err != nil {
		log.Errorf("rows.Err() for '%s' failed with %s\n", q, err)
		return nil, err
	}
	return res, nil
}

func dbGetNotesForUser(user *DbUser) ([]*Note, error) {
	var notes []*Note
	db := getDbMust()
	q := `
SELECT
	id,
	curr_version_id,
	is_deleted,
	is_public,
	is_starred,
	created_at,
	updated_at,
	size,
	format,
	title,
	content_sha1,
	tags
FROM notes
WHERE user_id = ?`
	rows, err := db.Query(q, user.ID)
	if err != nil {
		log.Errorf("db.Query('%s') failed with %s\n", q, err)
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var n Note
		var tagsSerialized string
		err = rows.Scan(
			&n.id,
			&n.CurrVersionID,
			&n.IsDeleted,
			&n.IsPublic,
			&n.IsStarred,
			&n.CreatedAt,
			&n.UpdatedAt,
			&n.Size,
			&n.Format,
			&n.Title,
			&n.ContentSha1,
			&tagsSerialized)
		if err != nil {
			return nil, err
		}
		n.userID = user.ID
		n.Tags = deserializeTags(tagsSerialized)
		n.SetCalculatedProperties()
		notes = append(notes, &n)
	}
	err = rows.Err()
	if err != nil {
		log.Errorf("rows.Err() for '%s' failed with %s\n", q, err)
		return nil, err
	}
	return notes, nil
}

var (
	recentPublicNotesCached     []Note
	recentPublicNotesLastUpdate time.Time
)

func timeExpired(t time.Time, dur time.Duration) bool {
	return t.IsZero() || time.Now().Sub(t) > dur
}

func getRecentPublicNotesCached(limit int) ([]Note, error) {
	var res []Note

	mu.Lock()
	defer mu.Unlock()

	needsRefreshFromDB := limit > len(recentPublicNotesCached) || timeExpired(recentPublicNotesLastUpdate, time.Minute*5)
	if !needsRefreshFromDB {
		res = make([]Note, limit, limit)
		for i := 0; i < limit; i++ {
			res[i] = recentPublicNotesCached[i]
		}
	}
	if len(res) == limit {
		return res, nil
	}

	db := getDbMust()
	q := `
SELECT
  id,
  user_id,
	curr_version_id,
	is_deleted,
	is_public,
	is_starred,
	created_at,
	updated_at,
	size,
	format,
	title,
	content_sha1,
	tags
FROM notes
WHERE is_public=true
ORDER BY updated_at DESC
LIMIT %d`

	rows, err := db.Query(fmt.Sprintf(q, limit))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var n Note
		var tagsSerialized string
		err = rows.Scan(
			&n.id,
			&n.userID,
			&n.CurrVersionID,
			&n.IsDeleted,
			&n.IsPublic,
			&n.IsStarred,
			&n.CreatedAt,
			&n.UpdatedAt,
			&n.Size,
			&n.Format,
			&n.Title,
			&n.ContentSha1,
			&tagsSerialized)
		if err != nil {
			return nil, err
		}
		n.Tags = deserializeTags(tagsSerialized)
		n.SetCalculatedProperties()
		res = append(res, n)
	}
	err = rows.Err()
	if err != nil {
		log.Errorf("rows.Err() for '%s' failed with %s\n", q, err)
		return nil, err
	}

	n := len(res)
	recentPublicNotesCached = make([]Note, n, n)
	for i := 0; i < n; i++ {
		recentPublicNotesCached[i] = res[i]
	}
	recentPublicNotesLastUpdate = time.Now()
	return res, nil
}

func trimTitle(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return nonWhitespaceRightTrim(s[:maxLen])
}

func getTitleFromBody(note *Note) string {
	content, err := getNoteContent(note)
	if err != nil {
		return ""
	}
	return string(getFirstLine(content))
}

func dbGetNoteByID(id int) (*Note, error) {
	var n Note
	var tagsSerialized string
	db := getDbMust()
	q := `
SELECT
  id,
  user_id,
  curr_version_id,
  is_deleted,
  is_public,
  is_starred,
  created_at,
  updated_at,
  size,
  format,
  title,
  content_sha1,
  tags
FROM notes
WHERE id=?`
	err := db.QueryRow(q, id).Scan(
		&n.id,
		&n.userID,
		&n.CurrVersionID,
		&n.IsDeleted,
		&n.IsPublic,
		&n.IsStarred,
		&n.CreatedAt,
		&n.UpdatedAt,
		&n.Size,
		&n.Format,
		&n.Title,
		&n.ContentSha1,
		&tagsSerialized)
	if err != nil {
		return nil, err
	}
	n.Tags = deserializeTags(tagsSerialized)
	n.SetCalculatedProperties()
	return &n, nil
}

func isValidProState(proState int) bool {
	switch proState {
	case NotProEligible, CanBePro, IsPro:
		return true
	default:
		return false
	}
}

// id, login, full_name, email, created_at, pro_state
func dbGetUserByQuery(q string, args ...interface{}) (*DbUser, error) {
	var user DbUser
	db := getDbMust()
	err := db.QueryRow(q, args...).Scan(&user.ID, &user.Login, &user.FullName, &user.Email, &user.CreatedAt, &user.ProState)
	if err != nil {
		if err != sql.ErrNoRows {
			log.Errorf("db.QueryRow('%s', %v) failed with '%s'\n", q, args, err)
			return nil, err
		}
		return nil, nil
	}
	if !isValidProState(user.ProState) {
		return nil, fmt.Errorf("invalid ProState '%d' for user from query '%s'", user.ProState, q)
	}
	return &user, nil
}

func dbGetUserByIDCached(userID int) (*DbUser, error) {
	var res *DbUser
	mu.Lock()
	res = userIDToDbUserCache[userID]
	mu.Unlock()
	if res != nil {
		return res, nil
	}
	res, err := dbGetUserByID(userID)
	if err != nil {
		return nil, err
	}
	mu.Lock()
	userIDToDbUserCache[userID] = res
	mu.Unlock()
	return res, nil
}

func dbGetUserByID(userID int) (*DbUser, error) {
	q := `SELECT id, login, full_name, email, created_at, pro_state FROM users WHERE id=?`
	return dbGetUserByQuery(q, userID)
}

func dbGetUserByLogin(login string) (*DbUser, error) {
	q := `SELECT id, login, full_name, email, created_at, pro_state FROM users WHERE login=?`
	return dbGetUserByQuery(q, login)
}

func dbGetAllUsers() ([]*DbUser, error) {
	db := getDbMust()
	q := `SELECT id, login, full_name, email, created_at, pro_state FROM users`
	rows, err := db.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var res []*DbUser
	for rows.Next() {
		var user DbUser
		err = rows.Scan(&user.ID, &user.Login, &user.FullName, &user.Email, &user.CreatedAt)
		if err != nil {
			return nil, err
		}
		res = append(res, &user)
	}
	return res, rows.Err()
}

func getWelcomeMD() []byte {
	if hasZipResources() {
		return resourcesFromZip["welcome.md"]
	}
	path := filepath.Join("data", "welcome.md")
	d, err := ioutil.ReadFile(path)
	fatalIfErr(err, "getWelcomeMD()")
	return d
}

// TODO: also insert oauthJSON
func dbGetOrCreateUser(userLogin string, fullName string) (*DbUser, error) {
	user, err := dbGetUserByLogin(userLogin)
	if user != nil {
		PanicIfErr(err)
		return user, nil
	}

	db := getDbMust()
	vals := NewDbVals("users", 3)
	vals.Add("login", userLogin)
	vals.Add("full_name", fullName)
	vals.Add("pro_state", NotProEligible)
	_, err = vals.Insert(db)
	if err != nil {
		return nil, err
	}

	dbUser, err := dbGetUserByLogin(userLogin)
	if err != nil {
		return nil, err
	}

	d := getWelcomeMD()
	if len(d) > 0 {
		note := &NewNote{
			title:     "Welcome!",
			format:    formatMarkdown,
			content:   d,
			tags:      []string{"quicknotes"},
			createdAt: time.Now(),
			isDeleted: false,
			isPublic:  false,
			isStarred: false,
		}
		_, err = dbCreateOrUpdateNote(dbUser.ID, note)
		if err != nil {
			log.Errorf("dbCreateOrUpdateNote() failed with '%s'\n", err)
		}
	}
	return dbUser, err
}

func getQuickNotesDb() (*sql.DB, error) {
	db, err := sql.Open("mysql", getSQLConnection())
	if err != nil {
		return nil, err
	}
	err = db.Ping()
	if err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

// note: no locking. the presumption is that this is called at startup and
// available throughout the lifetime of the program
func getDbMust() *sql.DB {
	sqlDbMu.Lock()
	defer sqlDbMu.Unlock()

	if sqlDb != nil {
		return sqlDb
	}

	db, err := getQuickNotesDb()
	if err != nil {
		if strings.Contains(err.Error(), "Error 1049") {
			log.Verbosef("db.Ping() failed because no database exists\n")
			createDatabaseMust()
		} else {
			fatalIfErr(err, "getQuickNotesDb")
		}
	}

	db, err = getQuickNotesDb()
	fatalIfErr(err, "getQuickNotesDb")
	err = upgradeDb(db)
	if err != nil {
		log.Fatalf("upgradeDb() failed with '%s'\n", err)
	}
	sqlDb = db
	return sqlDb
}

func closeDb() {
	if sqlDb != nil {
		sqlDb.Close()
		sqlDb = nil
	}
}
