package main

import (
	"bufio"
	"bytes"
	"database/sql"
	"fmt"
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
	currSchemaVersionStr        = "1"
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

func getCachedUserInfoByName(userName string) (*CachedUserInfo, error) {
	mu.Lock()
	i := userNameToCachedInfo[userName]
	mu.Unlock()
	if i != nil {
		LogVerbosef("user '%s', got from cache\n", userName)
		return i, nil
	}
	timeStart := time.Now()
	user, err := getUserByName(userName)
	if user == nil {
		return nil, err
	}
	notes, err := getNotesForUser(user)
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
	userNameToCachedInfo[userName] = res
	mu.Unlock()
	LogVerbosef("took %s for user '%s'\n", time.Since(timeStart), userName)
	return res, nil
}

// User is an information about the user
type User struct {
	ID        int
	Login     string // e.g. 'google:kkowalczyk@gmail'
	Name      string // e.g. 'kjk'
	Email     string
	CreatedAt time.Time
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
	} else {
		return "root:dribble-dribble-little-star@tcp(173.194.251.111:3306)/"
	}
}

func getSqlConnectionNotenik() string {
	return getSqlConnectionRoot() + "notenik?parseTime=true"
}

func upgradeDbMust(db *sql.DB) {
	var currVerStr string
	err := db.QueryRow(`SELECT v FROM kv WHERE k='schema_version'`).Scan(&currVerStr)
	if err != nil {
		log.Fatalf("db.QueryRow() failed with %s\n", err)
	}
	if currVerStr == currSchemaVersionStr {
		return
	}
	log.Fatalf("invalid version '%s'\n", currVerStr)
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

func createDatabaseMust() *sql.DB {
	LogVerbosef("trying to create the database\n")
	db, err := sql.Open("mysql", getSqlConnectionRoot())
	fatalIfErr(err, "sql.Open()")
	err = db.Ping()
	fatalIfErr(err, "db.Ping()")
	execMust(db, `CREATE DATABASE notenik CHARACTER SET utf8 COLLATE utf8_general_ci`)
	db.Close()

	db, err = sql.Open("mysql", getSqlConnectionNotenik())
	fatalIfErr(err, "sql.Open()")

	execMust(db, `
CREATE TABLE kv (
    k     VARCHAR(255) NOT NULL,
    v     VARCHAR(255),
    PRIMARY KEY (k)
)
`)

	execMust(db, `
CREATE TABLE users (
    id           INT NOT NULL AUTO_INCREMENT,
    login        VARCHAR(255),
    name         VARCHAR(255),
    email        VARCHAR(255),
    created_at   TIMESTAMP NOT NULL,
    PRIMARY KEY USING HASH (id),
    INDEX USING HASH (login),
    INDEX USING HASH (name),
    INDEX USING HASH (email)
)
`)

	execMust(db, `
CREATE TABLE versions (
    id              INT NOT NULL AUTO_INCREMENT,
    created_at      TIMESTAMP NOT NULL,
    note_id         INT NOT NULL,
    size            INT NOT NULL,
    format          INT NOT NULL,
    title           VARCHAR(512),
    content_sha1    VARBINARY(20),
    snippet_sha1    VARBINARY(20),
    tags            VARCHAR(512),
    PRIMARY KEY USING HASH (id),
    INDEX (note_id)
)
`)

	execMust(db, `
CREATE TABLE notes (
    id                INT NOT NULL AUTO_INCREMENT,
    user_id           INT NOT NULL ,
    curr_version_id   INT NOT NULL,
    PRIMARY KEY USING HASH (id),
    INDEX (user_id)
)
`)

	execMust(db, fmt.Sprintf(`INSERT INTO kv VALUES ('schema_version', '%s')`, currSchemaVersionStr))

	execMust(db, `INSERT INTO users (login, name, email, created_at) VALUES (?, ?, ?, now())`, kjkLogin, "kjk", "kkowalczyk@gmail.com")

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

func createNewNote(userID int, note *NewNote) (int, error) {
	u.PanicIf(len(note.content) == 0)
	contentSha1, snippetSha1, err := saveContent(note.content)
	if err != nil {
		LogErrorf("saveContent() failed with %s\n", err)
		return 0, err
	}
	ensureValidFormat(note.format)
	db := GetDbMust()
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

func getNotesForUser(user *User) ([]*Note, error) {
	var notes []*Note
	db := GetDbMust()
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

func getUserByLogin(login string) (*User, error) {
	var userID int
	var name, email string
	var createdAt time.Time
	db := GetDbMust()
	qs := `SELECT id, name, email, created_at FROM users WHERE login=?`
	err := db.QueryRow(qs, login).Scan(&userID, &name, &email, &createdAt)
	if err != nil {
		LogErrorf("db.QueryRow() failed with %s\n", err)
		return nil, err
	}
	res := &User{
		ID:        userID,
		Login:     login,
		Name:      name,
		Email:     email,
		CreatedAt: createdAt,
	}
	return res, nil
}

func getUserByName(name string) (*User, error) {
	var userID int
	var login, email string
	var createdAt time.Time
	db := GetDbMust()
	qs := `SELECT id, login, email, created_at FROM users WHERE name=?`
	err := db.QueryRow(qs, name).Scan(&userID, &login, &email, &createdAt)
	if err != nil {
		LogErrorf("db.QueryRow('%s') failed with %s\n", qs, err)
		return nil, err
	}
	res := &User{
		ID:        userID,
		Login:     login,
		Name:      name,
		Email:     email,
		CreatedAt: createdAt,
	}
	return res, nil
}

func deleteDatabaseMust() {
	LogVerbosef("trying to delete the database\n")
	db, err := sql.Open("mysql", getSqlConnectionRoot())
	fatalIfErr(err, "sql.Open()")
	err = db.Ping()
	fatalIfErr(err, "db.Ping()")
	execMust(db, `DROP DATABASE IF EXISTS notenik`)
	db.Close()
}

func recreateDatabaseMust() {
	deleteDatabaseMust()
	createDatabaseMust()
	user, err := getUserByLogin(kjkLogin)
	if err != nil {
		LogErrorf("getUserByLogin() failed with %s\n", err)
	} else {
		LogVerbosef("userId: %d\n", user.ID)
	}
}

// note: no locking. the presumption is that this is called at startup and
// available throughout the lifetime of the program
func GetDbMust() *sql.DB {
	if sqlDb != nil {
		return sqlDb
	}
	sqlDbMu.Lock()
	defer sqlDbMu.Unlock()
	db, err := sql.Open("mysql", getSqlConnectionNotenik())
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

func CloseDb() {
	if sqlDb != nil {
		sqlDb.Close()
		sqlDb = nil
	}
}
