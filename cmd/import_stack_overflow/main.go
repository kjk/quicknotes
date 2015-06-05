package main

import (
	"fmt"
	"log"
	"path/filepath"
	"runtime"

	"github.com/dustin/go-humanize"
	"github.com/kjk/lzmadec"
	"github.com/kjk/stackoverflow"
	"github.com/kjk/u"
)

var (
	dataDir string
	posts   map[int]int
)

func init() {
	dataDir = u.ExpandTildeInPath("~/data/import_stack_overflow")
	posts = make(map[int]int)
}

func fatalIfErr(err error) {
	if err != nil {
		log.Fatalf("err: %s\n", err)
	}
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

func main() {
	site := "academia"
	archiveFileName := site + ".stackexchange.com.7z"
	archiveFilePath := filepath.Join(dataDir, archiveFileName)
	archive, err := lzmadec.NewArchive(archiveFilePath)
	fatalIfErr(err)
	r, err := archive.GetFileReader("PostHistory.xml")
	fatalIfErr(err)
	hr, err := stackoverflow.NewPostHistoryReader(r)
	fatalIfErr(err)
	n := 0
	for hr.Next() {
		ph := &hr.PostHistory
		posts[ph.PostID]++
		n++
	}
	err = hr.Err()
	fatalIfErr(err)
	fmt.Printf("%d history entries, %d posts\n", n, len(posts))
	dumpMemStats()
}
