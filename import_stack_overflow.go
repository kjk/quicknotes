package main

import (
	"fmt"
	"math/rand"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/dustin/go-humanize"
	"github.com/kjk/lzmadec"
	"github.com/kjk/stackoverflow"
)

var (
	importDataDir     string
	posts             map[int]*PostChange
	historyTypeCounts map[int]int
	userIDToInfo      map[int]*UserInfo
)

// UserInfo is info about a user
type UserInfo struct {
	userID   int
	dbUserID int
	name     string
}

// PostChange records a change of a post
type PostChange struct {
	postID    int
	userID    int
	createdAt time.Time
	typ       int
	val       string
	tags      []string
	next      *PostChange
}

func init() {
	importDataDir = ExpandTildeInPath("~/data/import_stack_overflow")
	posts = make(map[int]*PostChange)
	historyTypeCounts = make(map[int]int)
	userIDToInfo = make(map[int]*UserInfo)
}

func toBytes(n uint64) string {
	return humanize.Bytes(n)
}

func dumpMemStats() {
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	fmt.Printf("Alloc      : %s\n", toBytes(ms.Alloc))
	fmt.Printf("HeapAlloc  : %s\n", toBytes(ms.HeapAlloc))
	fmt.Printf("HeapSys    : %s\n", toBytes(ms.HeapSys))
	fmt.Printf("HeapInuse  : %s\n", toBytes(ms.HeapInuse))
	fmt.Printf("HeapObjects: %d\n", ms.HeapObjects)
}

func isValidType(typ int) bool {
	switch typ {
	case stackoverflow.HistoryInitialTitle,
		stackoverflow.HistoryInitialBody,
		stackoverflow.HistoryInitialTags,
		stackoverflow.HistoryEditTitle,
		stackoverflow.HistoryEditBody,
		stackoverflow.HistoyrEditTags,
		stackoverflow.HistoryRollbackTitle,
		stackoverflow.HistoryRollbackBody,
		stackoverflow.HistoryRollbackTags:
		return true
	}
	return false
}

func isInitialType(typ int) bool {
	switch typ {
	case stackoverflow.HistoryInitialTitle,
		stackoverflow.HistoryInitialBody,
		stackoverflow.HistoryInitialTags:
		return true
	}
	return false
}

func postHistoryToPostChange(ph *stackoverflow.PostHistory) *PostChange {
	if !isValidType(ph.PostHistoryTypeID) {
		return nil
	}
	return &PostChange{
		postID:    ph.PostID,
		userID:    ph.UserID,
		createdAt: ph.CreationDate,
		typ:       ph.PostHistoryTypeID,
		val:       ph.Text,
		tags:      ph.Tags,
	}
}

func getHistoryReader(site string) *stackoverflow.Reader {
	archiveFileName := site + ".stackexchange.com.7z"
	archiveFilePath := filepath.Join(importDataDir, archiveFileName)
	archive, err := lzmadec.NewArchive(archiveFilePath)
	fatalIfErr(err, "")
	r, err := archive.GetFileReader("PostHistory.xml")
	fatalIfErr(err, "")
	hr, err := stackoverflow.NewPostHistoryReader(r)
	fatalIfErr(err, "")
	return hr
}

func dumpCounts(m map[int]int) {
	max := 0
	for k := range m {
		if k > max {
			max = k
		}
	}
	fmt.Print("History type counts:\n")
	for i := 0; i <= max; i++ {
		if count, ok := m[i]; ok {
			fmt.Printf("type: %d, count: %d\n", i, count)
		}
	}
}

func dumpPostChanges(pc *PostChange) {
	fmt.Printf("post: %d\n", pc.postID)
	for pc != nil {
		fmt.Printf("%d: '%s'\n", pc.typ, pc.val)
		pc = pc.next
	}
}

func getPostChangeLen(pc *PostChange) int {
	n := 0
	for pc != nil {
		n++
		pc = pc.next
	}
	return n
}

func findLargestHistory() *PostChange {
	var largestChange *PostChange
	largestLen := 0
	for _, pc := range posts {
		n := getPostChangeLen(pc)
		if n > largestLen {
			largestChange = pc
			largestLen = n
		}
	}
	return largestChange
}

func loadHistory(siteName string) {
	hr := getHistoryReader(siteName)
	n := 0
	shownTags := 0
	for hr.Next() {
		n++
		ph := &hr.PostHistory
		if false && ph.PostHistoryTypeID == stackoverflow.HistoryRollbackTags {
			if true && shownTags < 4 {
				fmt.Printf("tags: '%s', %v\n", ph.Text, ph.Tags)
				shownTags++
			}
		}
		if curr := userIDToInfo[ph.UserID]; curr == nil {
			userInfo := &UserInfo{
				name: ph.UserDisplayName,
			}
			if userInfo.name == "" {
				userInfo.name = fmt.Sprintf("user-%d", ph.UserID)
			}
			userIDToInfo[ph.UserID] = userInfo
			login := "test:" + strconv.Itoa(ph.UserID)
			user, err := dbGetOrCreateUser(login, userInfo.name)
			fatalIfErr(err, "dbGetOrCreateUser()")
			userInfo.dbUserID = user.ID
		}
		historyTypeCounts[ph.PostHistoryTypeID]++
		pc := postHistoryToPostChange(ph)
		if pc == nil {
			continue
		}
		pc.next = posts[pc.postID]
		posts[pc.postID] = pc
	}
	err := hr.Err()
	fatalIfErr(err, "")
	fmt.Printf("%d history entries, %d posts\n", n, len(posts))
	fmt.Printf("%d users\n", len(userIDToInfo))
}

func setInitialValue(pc *PostChange, n *NewNote) bool {
	if pc == nil {
		return false
	}
	n.createdAt = pc.createdAt
	switch pc.typ {
	case stackoverflow.HistoryInitialTitle:
		n.title = pc.val
		return true
	case stackoverflow.HistoryInitialBody:
		n.content = []byte(pc.val)
		return true
	case stackoverflow.HistoryInitialTags:
		n.tags = pc.tags
		return true
	default:
		return false
	}
}

func updateNoteValue(pc *PostChange, n *NewNote) {
	n.createdAt = pc.createdAt
	switch pc.typ {
	case stackoverflow.HistoryEditTitle,
		stackoverflow.HistoryRollbackTitle:
		n.title = pc.val
	case stackoverflow.HistoryEditBody,
		stackoverflow.HistoryRollbackBody:
		n.content = []byte(pc.val)
	case stackoverflow.HistoyrEditTags, stackoverflow.HistoryRollbackTags:
		n.tags = pc.tags
	default:
		panic("updateValue")
	}
}

func getInitialNote(curr *PostChange) (*PostChange, *NewNote) {
	n := &NewNote{}
	nInitalValues := 0
	for {
		isInitial := setInitialValue(curr, n)
		if !isInitial {
			break
		}
		nInitalValues++
		curr = curr.next
	}
	if 0 == nInitalValues {
		postID := -1
		if curr != nil {
			postID = curr.postID
		}
		fmt.Printf("unexpected: no initial values for post id %d\n", postID)
		return nil, nil
	}
	return curr, n
}

func typToStr(typ int) string {
	switch typ {
	case stackoverflow.HistoryInitialTitle:
		return "InitialTitle"
	case stackoverflow.HistoryInitialBody:
		return "InitialBody"
	case stackoverflow.HistoryInitialTags:
		return "InitialTags"
	case stackoverflow.HistoryEditTitle:
		return "EditTitle"
	case stackoverflow.HistoryEditBody:
		return "EditBody"
	case stackoverflow.HistoyrEditTags:
		return "EditTags"
	case stackoverflow.HistoryRollbackTitle:
		return "RollbackTitle"
	case stackoverflow.HistoryRollbackBody:
		return "RollbackBody"
	case stackoverflow.HistoryRollbackTags:
		return "RollbackTags"
	default:
		return fmt.Sprintf("typ: %d", typ)
	}
}

func reversePostChange(curr *PostChange) *PostChange {
	root := curr
	curr = curr.next
	root.next = nil
	for curr != nil {
		next := curr.next
		curr.next = root
		root = curr
		curr = next
	}
	return root
}

func dumpPostChange(pc *PostChange) {
	fmt.Printf("  %s\n", typToStr(pc.typ))
}

func dumpHistory(curr *PostChange) {
	fmt.Printf("id: %d\n", curr.postID)
	for curr != nil {
		dumpPostChange(curr)
		curr = curr.next
	}
}

func isMaybeHTML(s string) bool {
	idx := strings.Index(s, "<")
	if idx == -1 {
		return false
	}
	return strings.Index(s[idx:], ">") != -1
}

func detectFormat(note *NewNote) {
	if isMaybeHTML(string(note.content)) {
		note.format = formatHTML
	} else {
		note.format = formatText
	}
}

func importPosts() (int, int) {
	n := 0
	nVersions := 0
	var note *NewNote
	for _, currPost := range posts {
		userInfo := userIDToInfo[currPost.userID]
		userID := userInfo.dbUserID
		currPost = reversePostChange(currPost)
		//dumpHistory(currPost)
		currPost, note = getInitialNote(currPost)
		if note == nil {
			continue
		}
		if len(note.content) == 0 {
			continue
		}
		detectFormat(note)
		nVersions++
		note.isPublic = rand.Intn(1000) > 100 // make 90% of notes public
		_, err := dbCreateOrUpdateNote(userID, note)
		fatalIfErr(err, "dbCreateOrUpdateNote()")

		for currPost != nil {
			updateNoteValue(currPost, note)
			detectFormat(note)
			if len(note.content) > 0 {
				_, err := dbCreateOrUpdateNote(userID, note)
				fatalIfErr(err, "dbCreateOrUpdateNote()")
				nVersions++
			}
			currPost = currPost.next

			// TODO: 5% probability of changing note status
		}
		n++
		if n%300 == 0 {
			fmt.Print(".")
		}
	}
	return n, nVersions
}

func importStackOverflow() {
	siteName := "academia"
	fmt.Printf("loading site %s...", siteName)
	timeStart := time.Now()
	loadHistory(siteName)
	fmt.Printf(" done in %s\n", time.Since(timeStart))

	timeStart = time.Now()
	fmt.Printf("importing posts: ")
	nNotes, nVersions := importPosts()
	fmt.Printf("\nimported %d notes (%d versions) in %s\n", nNotes, nVersions, time.Since(timeStart))

	//pc := findLargestHistory()
	//dumpPostChanges(pc)
	//dumpCounts(historyTypeCounts)
	//dumpMemStats()
}
