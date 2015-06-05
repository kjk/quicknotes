package main

import (
	"fmt"
	"path/filepath"
	"runtime"

	"github.com/dustin/go-humanize"
	"github.com/kjk/lzmadec"
	"github.com/kjk/stackoverflow"
	"github.com/kjk/u"
)

var (
	dataDir           string
	posts             map[int]*PostChange
	historyTypeCounts map[int]int
	userIDToName      map[int]string
)

type PostChange struct {
	postID int
	userID int
	typ    int
	val    string
	next   *PostChange
}

func init() {
	dataDir = u.ExpandTildeInPath("~/data/import_stack_overflow")
	posts = make(map[int]*PostChange)
	historyTypeCounts = make(map[int]int)
	userIDToName = make(map[int]string)
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
	case stackoverflow.HistoryInitialTitle, stackoverflow.HistoryInitialBody,
		stackoverflow.HistoryInitialTags, stackoverflow.HistoryEditTitle,
		stackoverflow.HistoryEditBody, stackoverflow.HistoyrEditTags,
		stackoverflow.HistoryRollbackTitle, stackoverflow.HistoryRollbackBody,
		stackoverflow.HistoryRollbackTags:
		return true
	}
	return false
}

func postHistoryToPostChange(ph *stackoverflow.PostHistory) *PostChange {
	if !isValidType(ph.PostHistoryTypeID) {
		return nil
	}
	return &PostChange{
		postID: ph.PostID,
		userID: ph.UserID,
		typ:    ph.PostHistoryTypeID,
		val:    ph.Text,
	}
}

func getHistoryReader(site string) *stackoverflow.Reader {
	archiveFileName := site + ".stackexchange.com.7z"
	archiveFilePath := filepath.Join(dataDir, archiveFileName)
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

func importStackOverflow() {
	hr := getHistoryReader("academia")
	n := 0
	shownTags := 0
	for hr.Next() {
		n++
		ph := &hr.PostHistory
		if ph.PostHistoryTypeID == stackoverflow.HistoryInitialTags {
			if false && shownTags < 4 {
				fmt.Printf("tags: '%s'\n", ph.Text)
				shownTags++
			}
		}
		if ph.UserDisplayName != "" {
			if curr := userIDToName[ph.UserID]; curr == "" {
				userIDToName[ph.UserID] = ph.UserDisplayName
			}
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
	fmt.Printf("%d users\n", len(userIDToName))
	//pc := findLargestHistory()
	//dumpPostChanges(pc)
	//dumpCounts(historyTypeCounts)
	//dumpMemStats()
}
