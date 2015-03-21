package main

import (
	"bufio"
	"bytes"
	"database/sql"
	"fmt"
	"io/ioutil"
	"log"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/dustin/go-humanize"
	_ "github.com/go-sql-driver/mysql"
	"github.com/kjk/u"
)

const (
	tagsSepByte                 = 30          // record separator
	snippetSizeThreshold        = 1024        // 1 KB
	cachedContentSizeThresholed = 1024 * 1024 // 1 MB
	tagPublic                   = "__public"
)

const (
	formatInvalid  = 0
	formatText     = 1
	formatMarkdown = 2
	formatHTML     = 3
	formatLast     = formatHTML
)

var (
	sqlDb                *sql.DB
	sqlDbMu              sync.Mutex
	tagSepStr            = string([]byte{30})
	userNameToCachedInfo map[string]*CachedUserInfo
	contentCache         map[string]*CachedContentInfo
	// general purpose mutex for short-lived ops (like lookup/insert in a map)
	mu sync.Mutex
)

func init() {
	userNameToCachedInfo = make(map[string]*CachedUserInfo)
	contentCache = make(map[string]*CachedContentInfo)
}

// returns formatInvalid if invalid format
func formatFromString(s string) int {
	s = strings.ToLower(s)
	switch s {
	case "text", "1":
		return formatText
	case "markdown", "2":
		return formatMarkdown
	case "html", "3":
		return formatHTML
	default:
		return formatInvalid
	}
}

func boolFromString(s string) bool {
	s = strings.TrimSpace(s)
	if s == "1" || s == "true" {
		return true
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
	ID               int
	Login            sql.NullString // e.g. 'google:kkowalczyk@gmail'
	Handle           sql.NullString // e.g. 'kjk'
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
	UserID        int
	CurrVersionID int
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
	//UpdatedAt     time.Time
	ColorID   int
	Snippet   string
	IsPartial bool
	HumanSize string
	IsPublic  bool
	IDStr     string
}

// NewNote describes a new note to be inserted into a database
type NewNote struct {
	title     string
	format    int
	content   []byte
	tags      []string
	createdAt time.Time
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

func hasPublicTag(tags []string) bool {
	for _, tag := range tags {
		if tag == tagPublic {
			return true
		}
	}
	return false
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
	n.Snippet = string(getShortSnippet(snippet))
	//LogInfof("note: %d, snippet size: %d\n", n.Id, len(n.CachedSnippet))
}

// SetCalculatedProperties calculates some props
func (n *Note) SetCalculatedProperties() {
	n.IsPartial = !bytes.Equal(n.ContentSha1, n.SnippetSha1)
	n.HumanSize = humanize.Bytes(uint64(n.Size))
	n.IsPublic = hasPublicTag(n.Tags)
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
		d = d[advance:]
		if advance == 0 {
			lines = append(lines, d)
			break
		}
	}
	return bytes.Join(lines, []byte{'\n'})
}

// Content returns note content
func (n *Note) Content() string {
	content, err := getNoteContent(n)
	if err != nil {
		return ""
	}
	return string(content)
}

// CachedUserInfo has cached user info
type CachedUserInfo struct {
	user  *DbUser
	notes []*Note
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

func clearCachedUserInfoByHandle(userHandle string) {
	mu.Lock()
	delete(userNameToCachedInfo, userHandle)
	mu.Unlock()
}

func getCachedUserInfoByHandle(userHandle string) (*CachedUserInfo, error) {
	mu.Lock()
	i := userNameToCachedInfo[userHandle]
	mu.Unlock()
	if i != nil {
		LogVerbosef("user '%s', got from cache\n", userHandle)
		return i, nil
	}
	timeStart := time.Now()
	user, err := dbGetUserByHandle(userHandle)
	if user == nil {
		return nil, err
	}
	notes, err := dbGetNotesForUser(user)
	if err != nil {
		return nil, err
	}
	sort.Sort(notesByCreatedAt(notes))
	for i, n := range notes {
		n.ColorID = i % nCssColors
	}
	res := &CachedUserInfo{
		user:  user,
		notes: notes,
	}
	mu.Lock()
	userNameToCachedInfo[userHandle] = res
	mu.Unlock()
	LogVerbosef("took %s for user '%s'\n", time.Since(timeStart), userHandle)
	return res, nil
}

func ensureValidFormat(format int) {
	if format >= formatText && format <= formatLast {
		return
	}
	LogFatalf("invalid format: %d\n", format)
}

func getSqlConnectionRoot() string {
	if flgIsLocal {
		return "root@tcp(localhost:3306)/"
	}
	return "root:u3WK2VP9@tcp(173.194.251.111:3306)/"
}

func getSqlConnectionQuickNotes() string {
	return getSqlConnectionRoot() + "quicknotes?parseTime=true"
}

func fatalIfErr(err error, what string) {
	if err != nil {
		log.Fatalf("%s failed with %s\n", what, err)
	}
}

func execMust(db *sql.DB, q string, args ...interface{}) {
	LogVerbosef("db.Exec(): %s\n", q)
	_, err := db.Exec(q, args...)
	fatalIfErr(err, fmt.Sprintf("db.Exec('%s')", q))
}

func getCreateDbStatementsMust() []string {
	d, err := ioutil.ReadFile("createdb.sql")
	fatalIfErr(err, "getCreateDbStatementsMust")
	return strings.Split(string(d), "\n\n")
}

func upgradeDbMust(db *sql.DB) {
	//q := `SELECT 1 FROM migrations WHERE version = ?`
	//q := `INSERT INTO migrations (version) VALUES (?)``
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

	db, err = sql.Open("mysql", getSqlConnectionQuickNotes())
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
		// TODO: read from google storage
		return nil, err
	}
	return d, nil
}

func dbCreateNewNote(userID int, note *NewNote) (int, error) {
	u.PanicIf(len(note.content) == 0)
	contentSha1, snippetSha1, err := saveContent(note.content)
	if err != nil {
		LogErrorf("saveContent() failed with %s\n", err)
		return 0, err
	}
	ensureValidFormat(note.format)
	db := getDbMust()
	tx, err := db.Begin()
	if err != nil {
		return 0, err
	}
	q := `INSERT INTO notes (user_id, curr_version_id) VALUES (?, ?)`
	res, err := db.Exec(q, userID, 0)
	if err != nil {
		LogErrorf("db.Exec('%s') failed with %s\n", q, err)
		tx.Rollback()
		return 0, err
	}
	noteID, err := res.LastInsertId()
	if err != nil {
		LogErrorf("res.LastInsertId() of noteID failed with %s\n", err)
		tx.Rollback()
		return 0, err
	}
	serilizedTags := serializeTags(note.tags)
	if note.createdAt.IsZero() {
		q = `INSERT INTO versions (note_id, size, format, title, content_sha1, snippet_sha1, tags, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, now())`
		res, err = db.Exec(q, noteID, len(note.content), note.format, note.title, contentSha1, snippetSha1, serilizedTags)
	} else {
		q = `INSERT INTO versions (note_id, size, format, title, content_sha1, snippet_sha1, tags, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		res, err = db.Exec(q, noteID, len(note.content), note.format, note.title, contentSha1, snippetSha1, serilizedTags, note.createdAt)
	}
	if err != nil {
		LogErrorf("db.Exec('%s') failed with %s\n", q, err)
		tx.Rollback()
		return 0, err
	}
	versionID, err := res.LastInsertId()
	if err != nil {
		LogErrorf("res.LastInsertId() of versionId failed with %s\n", err)
		tx.Rollback()
		return 0, err
	}
	q = `UPDATE notes SET curr_version_id=? WHERE id=?`
	_, err = db.Exec(q, versionID, noteID)
	if err != nil {
		LogErrorf("db.Exec('%s') failed with %s\n", q, err)
		tx.Rollback()
		return 0, err
	}
	return int(noteID), tx.Commit()
}

func dbDeleteNote(noteID int) error {
	db := getDbMust()
	q := `
DELETE FROM notes
WHERE n.id=?`
	_, err := db.Exec(q, noteID)
	return err
}

func dbGetNotesForUser(user *DbUser) ([]*Note, error) {
	var notes []*Note
	db := getDbMust()
	q := `
SELECT
	n.id,
	n.user_id,
	n.curr_version_id,
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
	for rows.Next() {
		var n Note
		var tagsSerialized string
		err = rows.Scan(
			&n.id,
			&n.UserID,
			&n.CurrVersionID,
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

func dbGetNoteByID(id int) (*Note, error) {
	var n Note
	var tagsSerialized string
	db := getDbMust()
	q := `
	SELECT
		n.id,
		n.user_id,
		n.curr_version_id,
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
		&n.UserID,
		&n.CurrVersionID,
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
	return &n, nil
}

func dbGetUserByQuery(q string, args ...interface{}) (*DbUser, error) {
	var user DbUser
	db := getDbMust()
	err := db.QueryRow(q, args...).Scan(&user.ID, &user.Handle, &user.FullName, &user.Email, &user.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		LogErrorf("db.QueryRow() failed with %s\n", err)
		return nil, err
	}
	return &user, nil
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

// given userLogin like "twitter:kjk", return unique userHandle e.g. kjk,
// kjk_twitter, kjk_twitter1 etc.
func dbGetUniqueHandleFromLogin(userLogin string) (string, error) {
	parts := strings.SplitN(userLogin, ":", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("dbGetUniqueHandleFromLogin(): invalid userLogin '%s'", userLogin)
	}
	// TODO: ensure that handle is unique
	return parts[1], nil
}

func dbGetOrCreateUser(userLogin string, fullName string) (*DbUser, error) {
	user, err := dbGetUserByLogin(userLogin)
	if err != nil {
		return nil, err
	}
	if user != nil {
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
	db, err := sql.Open("mysql", getSqlConnectionQuickNotes())
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
			LogFatalf("db.Ping() failed with %s", err)
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
