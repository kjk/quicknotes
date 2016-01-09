package main

import (
	"bufio"
	"bytes"
	"database/sql"
	"errors"
	"fmt"
	"html/template"
	"io/ioutil"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/dustin/go-humanize"
	_ "github.com/go-sql-driver/mysql"
	"github.com/kjk/u"
)

// TODO: use prepared statements where possible

const (
	tagsSepByte                 = 30          // record separator
	snippetSizeThreshold        = 1024        // 1 KB
	cachedContentSizeThresholed = 1024 * 1024 // 1 MB
)

const (
	formatInvalid  = 0
	formatFirst    = 1
	formatText     = 1
	formatMarkdown = 2
	formatHTML     = 3
	formatLast     = formatHTML
)

var (
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

func getSqlConnectionRoot() string {
	if flgIsLocal && !flgProdDb {
		return "root@tcp(localhost:3306)/"
	}
	return "root:8Nmjt97WJFhR@tcp(173.194.251.111:3306)/"
}

func getSqlConnection() string {
	return getSqlConnectionRoot() + "quicknotes?parseTime=true"
}

func isValidFormat(format int) bool {
	return format >= formatFirst && format <= formatLast
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
	Login            string         // e.g. 'google:kkowalczyk@gmail'
	Handle           string         // e.g. 'kjk'
	FullName         sql.NullString // e.g. 'Krzysztof Kowalczyk'
	Email            sql.NullString
	TwitterOauthJSON sql.NullString
	GitHubOauthJSON  sql.NullString
	GoogleOauthJSON  sql.NullString
	CreatedAt        time.Time
}

// DbNote describes note as in database
type DbNote struct {
	id            int
	userID        int
	CurrVersionID int
	IsDeleted     bool
	IsPublic      bool
	IsStarred     bool
	Size          int
	Title         string
	Format        int
	ContentSha1   []byte
	SnippetSha1   []byte
	Tags          []string `json:",omitempty"`
	CreatedAt     time.Time
}

// Note describes note in memory
type Note struct {
	DbNote
	UpdatedAt time.Time
	Snippet   string
	IsPartial bool
	HumanSize string
	IDStr     string
}

// NewNote describes a new note to be inserted into a database
type NewNote struct {
	idStr       string
	title       string
	format      int
	content     []byte
	tags        []string
	createdAt   time.Time
	isDeleted   bool
	isPublic    bool
	contentSha1 []byte
	snippetSha1 []byte
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
		contentSha1: n.ContentSha1,
		snippetSha1: n.SnippetSha1,
	}
	nn.content, err = getCachedContent(nn.contentSha1)
	return nn, err
}

// CachedUserInfo has cached user info
type CachedUserInfo struct {
	user  *DbUser
	notes []*Note
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
	if n.Snippet != "" {
		return
	}

	snippet, err := getNoteSnippet(n)
	if err != nil {
		return
	}
	// TODO: make this trimming when we create snippet sha1
	n.Snippet = strings.TrimSpace(string(getShortSnippet(snippet)))
	//LogInfof("note: %d, snippet size: %d\n", n.Id, len(n.CachedSnippet))
}

// SetCalculatedProperties calculates some props
func (n *Note) SetCalculatedProperties() {
	n.IsPartial = !bytes.Equal(n.ContentSha1, n.SnippetSha1)
	n.HumanSize = humanize.Bytes(uint64(n.Size))
	n.IDStr = hashInt(n.id)
	n.SetSnippet()
}

func getShortSnippet(d []byte) []byte {
	var lines [][]byte
	maxLines := 10
	sizeLeft := 512
	prevWasEmpty := false
	for len(d) > 0 && sizeLeft > 0 && len(lines) < maxLines {
		advance, line, err := bufio.ScanLines(d, false)
		if err != nil {
			break
		}

		skip := len(line) == 0 && prevWasEmpty
		if !skip {
			lines = append(lines, line)
			sizeLeft -= len(line)
		}
		prevWasEmpty = len(line) == 0
		if advance == 0 {
			lines = append(lines, d)
			break
		}
		d = d[advance:]
	}
	return bytes.Join(lines, []byte{'\n'})
}

// returns first non-empty line
func getFirstLine(d []byte) []byte {
	for {
		advance, line, err := bufio.ScanLines(d, false)
		if err != nil {
			return nil
		}
		if len(line) > 0 {
			return line
		}
		if advance == 0 {
			return nil
		}
		d = d[advance:]
	}
}

// Content returns note content
func (n *Note) Content() string {
	content, err := getNoteContent(n)
	if err != nil {
		return ""
	}
	return string(content)
}

// ContentHTML returns note content in HTML
func (n *Note) ContentHTML() template.HTML {
	content, err := getNoteContentHTML(n)
	if err != nil {
		return template.HTML("")
	}
	return template.HTML(content)
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
	d, err := loadContent(sha1)
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

func getNoteSnippet(note *Note) ([]byte, error) {
	return getCachedContent(note.SnippetSha1)
}

func getNoteContent(note *Note) ([]byte, error) {
	return getCachedContent(note.ContentSha1)
}

func getNoteContentHTML(note *Note) (template.HTML, error) {
	c, err := getCachedContent(note.ContentSha1)
	if err != nil {
		return "", err
	}
	if note.Format == formatText {
		// TODO: escape < etc. chars
		s := `<pre class="note-body">` + string(c) + "</pre>"
		return template.HTML(s), nil
	}
	if note.Format == formatHTML {
		s := string(c)
		return template.HTML(s), nil
	}
	if note.Format == formatMarkdown {
		s := markdownToHTML(c)
		return template.HTML(s), nil
	}
	return "", errors.New("unknown format")
}

func clearCachedUserInfo(userID int) {
	mu.Lock()
	delete(userIDToCachedInfo, userID)
	mu.Unlock()
}

func getCachedUserInfo(userID int) (*CachedUserInfo, error) {
	mu.Lock()
	i := userIDToCachedInfo[userID]
	mu.Unlock()
	if i != nil {
		LogVerbosef("user '%d', got from cache\n", userID)
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
		user:  user,
		notes: notes,
	}
	mu.Lock()
	userIDToCachedInfo[userID] = res
	mu.Unlock()
	LogVerbosef("took %s for user '%d'\n", time.Since(timeStart), userID)
	return res, nil
}

// TODO: add withPrivateNotes
func getCachedUserInfoByHandle(userHandle string) (*CachedUserInfo, error) {
	user, err := dbGetUserByHandle(userHandle)
	if err != nil {
		return nil, err
	}
	return getCachedUserInfo(user.ID)
}

func ensureValidFormat(format int) {
	if format >= formatText && format <= formatLast {
		return
	}
	LogFatalf("invalid format: %d\n", format)
}

func execMust(db *sql.DB, q string, args ...interface{}) {
	LogVerbosef("db.Exec(): %s\n", q)
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
	return strings.Split(string(d), "\n\n")
}

func upgradeDbMust(db *sql.DB) {
	//q := `SELECT 1 FROM dbmigrations WHERE version = ?`
	//q := `INSERT INTO dbmigrations (version) VALUES (?)``
	// TODO: implement me
}

func createDatabaseMust() *sql.DB {
	LogVerbosef("trying to create the database\n")
	db, err := sql.Open("mysql", getSqlConnectionRoot())
	fatalIfErr(err, "sql.Open()")
	err = db.Ping()
	fatalIfErr(err, "db.Ping()")
	execMust(db, `CREATE DATABASE quicknotes CHARACTER SET utf8 COLLATE utf8_general_ci`)
	db.Close()

	db, err = sql.Open("mysql", getSqlConnection())
	fatalIfErr(err, "sql.Open()")
	stmts := getCreateDbStatementsMust()
	for _, stm := range stmts {
		execMust(db, stm)
	}

	LogVerbosef("created database\n")
	err = db.Ping()
	fatalIfErr(err, "db.Ping()")
	return db
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

func saveContentOne(d []byte) ([]byte, error) {
	sha1, err := localStore.PutContent(d)
	if err != nil {
		return nil, err
	}
	return sha1, err
}

// save to local store and google storage
// we only save snippets locally
func saveContent(d []byte) ([]byte, []byte, error) {
	sha1, err := saveContentOne(d)
	if err != nil {
		return nil, nil, err
	}
	err = saveNoteToGoogleStorage(sha1, d)
	if err != nil {
		return nil, nil, err
	}

	snippetSha1 := sha1
	if len(d) <= snippetSizeThreshold {
		return sha1, snippetSha1, nil
	}

	snippet := d[:snippetSizeThreshold]
	snippetSha1, err = saveContentOne(snippet)
	if err != nil {
		return nil, nil, err
	}
	err = saveNoteToGoogleStorage(snippetSha1, snippet)
	if err != nil {
		return nil, nil, err
	}
	return sha1, snippetSha1, nil
}

func loadContent(sha1 []byte) ([]byte, error) {
	d, err := localStore.GetContentBySha1(sha1)
	if err != nil {
		d, err = readNoteFromGoogleStorage(sha1)
		if err != nil {
			return nil, err
		}
		// cache locally
		localStore.PutContent(d)
	}
	return d, nil
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

	fatalif(note.contentSha1 == nil, "note.contentSha1 is nil")
	fatalif(note.snippetSha1 == nil, "note.snippetSha1 is nil")

	// for non-imported notes use current time as note creation time
	if note.createdAt.IsZero() {
		note.createdAt = time.Now()
	}
	q := `INSERT INTO notes (user_id, curr_version_id, created_at, is_deleted, is_public, versions_count, is_starred) VALUES (?, ?, ?, ?, ?, 1, false)`
	res, err := tx.Exec(q, userID, 0, note.createdAt, note.isDeleted, note.isPublic)
	if err != nil {
		LogErrorf("tx.Exec('%s') failed with %s\n", q, err)
		//TODO: ignore for now
		//return 0, err
		return 0, nil
	}
	noteID, err := res.LastInsertId()
	if err != nil {
		LogErrorf("res.LastInsertId() of noteID failed with %s\n", err)
		return 0, err
	}
	serilizedTags := serializeTags(note.tags)
	q = `INSERT INTO versions (note_id, size, format, title, content_sha1, snippet_sha1, tags, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	res, err = tx.Exec(q, noteID, len(note.content), note.format, note.title, note.contentSha1, note.snippetSha1, serilizedTags, note.createdAt)
	if err != nil {
		LogErrorf("tx.Exec('%s') failed with %s\n", q, err)
		return 0, err
	}
	versionID, err := res.LastInsertId()
	if err != nil {
		LogErrorf("res.LastInsertId() of versionId failed with %s\n", err)
		return 0, err
	}
	q = `UPDATE notes SET curr_version_id=? WHERE id=?`
	_, err = tx.Exec(q, versionID, noteID)
	if err != nil {
		LogErrorf("tx.Exec('%s') failed with %s\n", q, err)
		return 0, err
	}
	err = tx.Commit()
	tx = nil
	return int(noteID), err
}

func dbUpdateNoteWith(userID, noteID int, updateFn func(*NewNote)) error {
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
	updateFn(newNote)
	// TODO: wasteful, because will call dbGetNoteByID() again
	_, err = dbUpdateNote(userID, newNote)
	return err
}

func dbUpdateNoteTitle(userID, noteID int, newTitle string) error {
	return dbUpdateNoteWith(userID, noteID, func(newNote *NewNote) {
		newNote.title = newTitle
	})
}

func dbUpdateNoteTags(userID, noteID int, newTags []string) error {
	return dbUpdateNoteWith(userID, noteID, func(newNote *NewNote) {
		newNote.tags = newTags
	})
}

func dbUpdateNote(userID int, note *NewNote) (int, error) {
	noteID := dehashInt(note.idStr)
	existingNote, err := dbGetNoteByID(noteID)
	if err != nil {
		return 0, err
	}
	if existingNote.userID != userID {
		return 0, fmt.Errorf("user %d is trying to update note that belongs to user %d", userID, existingNote.userID)
	}
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

	if note.createdAt.IsZero() {
		note.createdAt = time.Now()
	}

	needNewVersion := false
	if !bytes.Equal(note.contentSha1, existingNote.ContentSha1) {
		needNewVersion = true
	}
	if note.format != existingNote.Format {
		needNewVersion = true
	}
	if note.title != existingNote.Title {
		needNewVersion = true
	}
	if !strArrEqual(note.tags, existingNote.Tags) {
		needNewVersion = true
	}

	if needNewVersion {
		//LogInfof("inserting new version of note %d\n", noteID)
		serilizedTags := serializeTags(note.tags)
		q := `INSERT INTO versions (note_id, size, format, title, content_sha1, snippet_sha1, tags, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		res, err := tx.Exec(q, noteID, len(note.content), note.format, note.title, note.contentSha1, note.snippetSha1, serilizedTags, note.createdAt)
		if err != nil {
			LogErrorf("tx.Exec('%s') failed with %s\n", q, err)
			return 0, err
		}
		versionID, err := res.LastInsertId()
		if err != nil {
			LogErrorf("res.LastInsertId() of versionId failed with %s\n", err)
			return 0, err
		}
		q = `UPDATE notes SET curr_version_id=?, versions_count = versions_count + 1 WHERE id=?`
		_, err = tx.Exec(q, versionID, noteID)
		if err != nil {
			LogErrorf("tx.Exec('%s') failed with %s\n", q, err)
			return 0, err
		}
	}

	// TODO: could combine with the above update in some cases
	if note.isPublic != existingNote.IsPublic {
		LogInfof("changing is_public status of note %d to %v\n", noteID, note.isPublic)
		q := `UPDATE notes SET is_public=? WHERE id=?`
		_, err = tx.Exec(q, note.isPublic, noteID)
		if err != nil {
			LogErrorf("tx.Exec('%s') failed with %s\n", q, err)
			return 0, err
		}
	}

	err = tx.Commit()
	tx = nil
	return int(noteID), err
}

// create a new note. if note.createdAt is non-zero value, this is an import
// of from somewhere else, so we want to preserve that
func dbCreateOrUpdateNote(userID int, note *NewNote) (int, error) {
	var err error
	if len(note.content) == 0 {
		return 0, errors.New("empty note content")
	}
	note.contentSha1, note.snippetSha1, err = saveContent(note.content)
	if err != nil {
		LogErrorf("saveContent() failed with %s\n", err)
		return 0, err
	}
	if !isValidFormat(note.format) {
		return 0, fmt.Errorf("invalid format %d", note.format)
	}

	var noteID int
	if note.idStr == "" {
		noteID, err = dbCreateNewNote(userID, note)
		note.idStr = hashInt(noteID)
	} else {
		noteID, err = dbUpdateNote(userID, note)
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
		WHERE note_id=?
	`
	_, err = db.Exec(q, noteID)
	if err != nil {
		return err
	}
	tx = nil
	return nil
}

func dbSetNoteDeleteState(userID, noteID int, isDeleted bool) error {
	db := getDbMust()
	// matching against user_id is not necessary, added just to prevent potential bugs
	q := `UPDATE notes SET is_deleted=? WHERE id=? AND user_id=?`
	_, err := db.Exec(q, isDeleted, noteID, userID)
	if err != nil {
		LogErrorf("db.Exec() failed with '%s'\n", err)
	}
	clearCachedUserInfo(userID)
	return err
}

func dbDeleteNote(userID, noteID int) error {
	return dbSetNoteDeleteState(userID, noteID, true)
}

func dbUndeleteNote(userID, noteID int) error {
	return dbSetNoteDeleteState(userID, noteID, false)
}

func dbSetNotePublicState(userID, noteID int, isPublic bool) error {
	LogInfof("userID: %d, noteID: %d, isPublic: %v\n", userID, noteID, isPublic)
	db := getDbMust()
	// matching against user_id is not necessary, added just to prevent potential bugs
	q := `UPDATE notes SET is_public=? WHERE id=? AND user_id=?`
	_, err := db.Exec(q, isPublic, noteID, userID)
	if err != nil {
		LogErrorf("db.Exec() failed with '%s'\n", err)
	}
	clearCachedUserInfo(userID)
	return err
}

func dbMakeNotePublic(userID, noteID int) error {
	return dbSetNotePublicState(userID, noteID, true)
}

func dbMakeNotePrivate(userID, noteID int) error {
	return dbSetNotePublicState(userID, noteID, false)
}

func dbSetNoteStarredState(userID, noteID int, isStarred bool) error {
	LogInfof("userID: %d, noteID: %d, isStarred: %v\n", userID, noteID, isStarred)
	db := getDbMust()
	// matching against user_id is not necessary, added just to prevent potential bugs
	q := `UPDATE notes SET is_starred=? WHERE id=? AND user_id=?`
	_, err := db.Exec(q, isStarred, noteID, userID)
	if err != nil {
		LogErrorf("db.Exec() failed with '%s'\n", err)
	}
	clearCachedUserInfo(userID)
	return err
}

func dbUnstarNote(userID, noteID int) error {
	return dbSetNoteStarredState(userID, noteID, false)
}

func dbStarNote(userID, noteID int) error {
	return dbSetNoteStarredState(userID, noteID, true)
}

// note: only use locally for testing search, not in production
func dbGetAllNotes() ([]*Note, error) {
	var notes []*Note
	db := getDbMust()
	q := `
SELECT
	n.id,
	n.user_id,
	n.curr_version_id,
	n.is_deleted,
	n.is_public,
	n.is_starred,
	v.created_at,
	v.size,
	v.format,
	v.title,
	v.content_sha1,
	v.snippet_sha1,
	v.tags
FROM notes n, versions v
WHERE v.id = n.curr_version_id
LIMIT 10000`
	rows, err := db.Query(q)
	if err != nil {
		LogErrorf("db.Query('%s') failed with %s\n", q, err)
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
			&n.Size,
			&n.Format,
			&n.Title,
			&n.ContentSha1,
			&n.SnippetSha1,
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
		LogErrorf("rows.Err() for '%s' failed with %s\n", q, err)
		return nil, err
	}
	return notes, nil
}

func dbGetNotesForUser(user *DbUser) ([]*Note, error) {
	var notes []*Note
	db := getDbMust()
	q := `
SELECT
	n.id,
	n.user_id,
	n.curr_version_id,
	n.is_deleted,
	n.is_public,
	n.is_starred,
	v.created_at,
	v.size,
	v.format,
	v.title,
	v.content_sha1,
	v.snippet_sha1,
	v.tags
FROM notes n, versions v
WHERE user_id=? AND v.id = n.curr_version_id`
	rows, err := db.Query(q, user.ID)
	if err != nil {
		LogErrorf("db.Query('%s') failed with %s\n", q, err)
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
			&n.Size,
			&n.Format,
			&n.Title,
			&n.ContentSha1,
			&n.SnippetSha1,
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
		LogErrorf("rows.Err() for '%s' failed with %s\n", q, err)
		return nil, err
	}
	return notes, nil
}

// NoteSummary desribes a note for e.g. display on index page
type NoteSummary struct {
	id         int
	IDStr      string
	UserHandle string
	Title      string
	UpdatedAt  time.Time
}

var (
	recentPublicNotesCached     []NoteSummary
	recentPublicNotesLastUpdate time.Time
)

func timeExpired(t time.Time, dur time.Duration) bool {
	return t.IsZero() || time.Now().Sub(t) > dur
}

func getRecentPublicNotesCached(limit int) ([]NoteSummary, error) {
	var res []NoteSummary
	mu.Lock()
	if len(recentPublicNotesCached) >= limit && !timeExpired(recentPublicNotesLastUpdate, time.Minute) {
		res = make([]NoteSummary, limit, limit)
		for i := 0; i < limit; i++ {
			res[i] = recentPublicNotesCached[i]
		}
	}
	mu.Unlock()
	if len(res) == limit {
		return res, nil
	}
	db := getDbMust()
	q := `
		SELECT DISTINCT id
		FROM notes
		WHERE is_public=true
		ORDER BY id DESC
		LIMIT %d
	`
	rows, err := db.Query(fmt.Sprintf(q, limit))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []int
	var noteID int
	for rows.Next() {
		err = rows.Scan(&noteID)
		ids = append(ids, noteID)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return res, nil
	}

	for _, noteID := range ids {
		// TODO: add and use dbGetNoteByIDCached
		note, err := dbGetNoteByID(noteID)
		if err != nil {
			return nil, err
		}
		var ns NoteSummary
		ns.Title = note.Title
		ns.UpdatedAt = note.UpdatedAt
		ns.IDStr = note.IDStr
		dbUser, err := dbGetUserByIDCached(note.userID)
		if err != nil {
			return nil, err
		}
		ns.UserHandle = dbUser.Handle
		if ns.Title == "" {
			ns.Title = getTitleFromBody(note)
		}
		ns.Title = trimTitle(ns.Title, 60)
		res = append(res, ns)
	}

	mu.Lock()
	n := len(res)
	recentPublicNotesCached = make([]NoteSummary, n, n)
	for i := 0; i < n; i++ {
		recentPublicNotesCached[i] = res[i]
	}
	recentPublicNotesLastUpdate = time.Now()
	mu.Unlock()
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

func isWs(c byte) bool {
	switch c {
	case ' ', '\t', '\n':
		return true
	}
	return false
}

// trim from the right all non-whitespace chars
func nonWhitespaceRightTrim(s string) string {
	n := len(s) - 1
	for ; n >= 0 && !isWs(s[n]); n-- {
	}
	if n < 15 {
		return s
	}
	s = s[:n]
	return s + "..."
}

func dbGetNoteByID(id int) (*Note, error) {
	var n Note
	var tagsSerialized string
	db := getDbMust()
	q := `
	SELECT
		n.id,
		n.user_id,
		n.curr_version_id,
		n.is_deleted,
		n.is_public,
		n.is_starred,
		n.created_at,
		v.created_at,
		v.size,
		v.format,
		v.title,
		v.content_sha1,
		v.snippet_sha1,
		v.tags
	FROM notes n, versions v
	WHERE n.id=? AND v.id = n.curr_version_id`
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
		&n.SnippetSha1,
		&tagsSerialized)
	if err != nil {
		return nil, err
	}
	n.Tags = deserializeTags(tagsSerialized)
	n.SetCalculatedProperties()
	return &n, nil
}

func dbGetUserByQuery(q string, args ...interface{}) (*DbUser, error) {
	var user DbUser
	db := getDbMust()
	err := db.QueryRow(q, args...).Scan(&user.ID, &user.Handle, &user.FullName, &user.Email, &user.CreatedAt)
	if err != nil {
		if err != sql.ErrNoRows {
			LogInfof("db.QueryRow('%s') failed with %s\n", q, err)
		}
		return nil, err
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
	q := `SELECT id, handle, full_name, email, created_at FROM users WHERE id=?`
	return dbGetUserByQuery(q, userID)
}

func dbGetUserByLogin(login string) (*DbUser, error) {
	q := `SELECT id, handle, full_name, email, created_at FROM users WHERE login=?`
	return dbGetUserByQuery(q, login)
}

func dbGetUserByHandle(userHandle string) (*DbUser, error) {
	q := `SELECT id, handle, full_name, email, created_at FROM users WHERE handle=?`
	return dbGetUserByQuery(q, userHandle)
}

func dbGetAllUsers() ([]*DbUser, error) {
	db := getDbMust()
	q := `SELECT id, handle, full_name, email, created_at FROM users`
	rows, err := db.Query(q)
	if err != nil {
		return nil, err
	}

	defer rows.Close()
	var res []*DbUser
	for rows.Next() {
		var user DbUser
		err = rows.Scan(&user.ID, &user.Handle, &user.FullName, &user.Email, &user.CreatedAt)
		if err != nil {
			return nil, err
		}
		res = append(res, &user)
	}
	return res, nil
}

// given userLogin like "twitter:kjk", return unique userHandle
// e.g. kjk, kjk1, kjk2
// TODO: this needs to be protected with a mutex
func dbGetUniqueHandleFromLogin(userLogin string) (string, error) {
	parts := strings.SplitN(userLogin, ":", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("dbGetUniqueHandleFromLogin(): invalid userLogin '%s'", userLogin)
	}
	db := getDbMust()
	q := `SELECT id FROM users WHERE handle=?`
	handle := parts[1]
	var id int
	for i := 1; i < 10; i++ {
		err := db.QueryRow(q, handle).Scan(&id)
		if err != nil {
			// if error is 'no more rows', this is a free handle
			if err == sql.ErrNoRows {
				return handle, nil
			}
			return "", err
		}
		handle = fmt.Sprintf("%s%d", parts[1], i)
	}
	return "", fmt.Errorf("couldn't generate unique handle for %s", userLogin)
}

func dbGetOrCreateUser(userLogin string, fullName string) (*DbUser, error) {
	user, err := dbGetUserByLogin(userLogin)
	if user != nil {
		u.PanicIfErr(err)
		return user, nil
	}
	userHandle, err := dbGetUniqueHandleFromLogin(userLogin)
	if err != nil {
		return nil, err
	}

	db := getDbMust()
	q := `INSERT INTO users (login, handle, fulL_name) VALUES (?, ?, ?)`
	_, err = db.Exec(q, userLogin, userHandle, fullName)
	if err != nil {
		return nil, err
	}
	return dbGetUserByLogin(userLogin)
}

func deleteDatabaseMust() {
	LogVerbosef("trying to delete the database\n")
	db, err := sql.Open("mysql", getSqlConnectionRoot())
	fatalIfErr(err, "sql.Open()")
	err = db.Ping()
	fatalIfErr(err, "db.Ping()")
	execMust(db, `DROP DATABASE IF EXISTS quicknotes`)
	db.Close()
}

func recreateDatabaseMust() {
	deleteDatabaseMust()
	createDatabaseMust()
}

// note: no locking. the presumption is that this is called at startup and
// available throughout the lifetime of the program
func getDbMust() *sql.DB {
	if sqlDb != nil {
		return sqlDb
	}
	sqlDbMu.Lock()
	defer sqlDbMu.Unlock()
	db, err := sql.Open("mysql", getSqlConnection())
	if err != nil {
		LogFatalf("sql.Open() failed with %s", err)
	}
	err = db.Ping()
	if err != nil {
		db.Close()
		if strings.Contains(err.Error(), "Error 1049") {
			LogVerbosef("db.Ping() failed because no database exists\n")
			db = createDatabaseMust()
		} else {
			LogFatalf("db.Ping() failed with %s\n", err)
		}
	} else {
		upgradeDbMust(db)
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
