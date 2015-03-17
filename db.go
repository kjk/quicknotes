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
	tagsSepByte                 = 30 // record separator
	kjkLogin                    = "google:kkowalczyk@gmail.com"
	snippetSizeThreshold        = 1024        // 1 KB
	cachedContentSizeThresholed = 1024 * 1024 // 1 MB
)

const (
	formatInvalid = iota
	formatText
	formatMarkdown
	formatHTML
	formatLast = formatHTML
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

// CachedContentInfo
type CachedContentInfo struct {
	lastAccessTime time.Time
	d              []byte
}

/*
type Note struct {
	Id           string
	Title        string
	Format       string
	Tags         []string `json:",omitempty"`
	CreationTime time.Time
	UpdateTime   time.Time
	HtmlShort    string
	Html         string // not always set
}
*/

// Note describes note in memory
type Note struct {
	ID            int
	CurrVersionID int
	Size          int
	Title         string
	Format        int
	ContentSha1   []byte
	SnippetSha1   []byte
	Tags          []string `json:",omitempty"`
	CreatedAt     time.Time
	//UpdatedAt     time.Time
	ColorID   int
	Snippet   string
	IsPartial bool
	HumanSize string
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

// SetIsPartial calculates if the content is partial
func (n *Note) SetIsPartial() {
	n.IsPartial = !bytes.Equal(n.ContentSha1, n.SnippetSha1)
}

func (n *Note) SetHumanSize() {
	n.HumanSize = humanize.Bytes(uint64(n.Size))
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

func (n *Note) Content() string {
	content, err := getNoteContent(n)
	if err != nil {
		return ""
	}
	return string(content)
}

type CachedUserInfo struct {
	user  *User
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

// User is an information about the user
type User struct {
	ID               int
	Login            string // e.g. 'google:kkowalczyk@gmail'
	Handle           string // e.g. 'kjk'
	FullName         string // e.g. 'Krzysztof Kowalczyk'
	Email            string
	TwitterOauthJSON string
	GitHubOauthJSON  string
	GoogleOauthJSON  string
	CreatedAt        time.Time
}

// NewNote describes a new note to be inserted into a database
type NewNote struct {
	title     string
	format    int
	content   []byte
	tags      []string
	createdAt time.Time
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

func dbGetNotesForUser(user *User) ([]*Note, error) {
	var notes []*Note
	db := getDbMust()
	qs := `
SELECT
	n.id,
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
	rows, err := db.Query(qs, user.ID)
	if err != nil {
		LogErrorf("db.Query('%s') failed with %s\n", qs, err)
		return nil, err
	}
	for rows.Next() {
		var note Note
		var tagsSerialized string
		err = rows.Scan(&note.ID,
			&note.CurrVersionID,
			&note.CreatedAt,
			&note.Size,
			&note.Format,
			&note.Title,
			&note.ContentSha1,
			&note.SnippetSha1,
			&tagsSerialized)
		if err != nil {
			return nil, err
		}
		note.Tags = deserializeTags(tagsSerialized)
		notes = append(notes, &note)
	}
	err = rows.Err()
	if err != nil {
		LogErrorf("rows.Err() for '%s' failed with %s\n", qs, err)
		return nil, err
	}
	return notes, nil
}

func dbGetUserByQuery(qs string, args ...interface{}) (*User, error) {
	var user User
	db := getDbMust()
	err := db.QueryRow(qs, args...).Scan(&user.ID, &user.Handle, &user.FullName, &user.Email, &user.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		LogErrorf("db.QueryRow() failed with %s\n", err)
		return nil, err
	}
	return &user, nil
}

func dbGetUserByID(userID int) (*User, error) {
	qs := `SELECT id, handle, full_name, email, created_at FROM users WHERE id=?`
	return dbGetUserByQuery(qs, userID)
}

func dbGetUserByLogin(login string) (*User, error) {
	qs := `SELECT id, handle, full_name, email, created_at FROM users WHERE login=?`
	return dbGetUserByQuery(qs, login)
}

func dbGetUserByHandle(userHandle string) (*User, error) {
	qs := `SELECT id, handle, full_name, email, created_at FROM users WHERE handle=?`
	return dbGetUserByQuery(qs, userHandle)
}

func dbGetOrCreateUser(userHandle string, fullName string) (*User, error) {
	user, err := dbGetUserByHandle(userHandle)
	if err != nil {
		return nil, err
	}
	return user, nil
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
	/*
		user, err := getUserByLogin(kjkLogin)
		if err != nil {
			LogErrorf("getUserByLogin() failed with %s\n", err)
		} else {
			LogVerbosef("userId: %d\n", user.ID)
		}*/

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
