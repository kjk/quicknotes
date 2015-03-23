package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/kjk/u"
)

const (
	formatInvalid  = 0
	formatText     = 1
	formatMarkdown = 2
	formatHTML     = 3
	formatLast     = formatHTML
)

// this programs converts my blog posts into .json format that can be
// imported into quicknotes for testing

// Note describes a note that can be imported into QuickNotes
type Note struct {
	Title     string
	Content   []byte
	Format    int
	Tags      []string `json:",omitempty"`
	IsPublic  bool
	IsDeleted bool
	CreatedAt time.Time
}

func isSepLine(s string) bool {
	return strings.HasPrefix(s, "-----")
}

func parseTags(s string) []string {
	tags := strings.Split(s, ",")
	for i, tag := range tags {
		tag = strings.TrimSpace(tag)
		tag = strings.ToLower(tag)
		tags[i] = tag
	}
	return tags
}

func parseFormat(s string) int {
	s = strings.ToLower(s)
	switch s {
	case "html":
		return formatHTML
	case "textile":
		return formatInvalid
	case "markdown", "md":
		return formatMarkdown
	case "text":
		return formatText
	default:
		return formatInvalid
	}
}

func parseDate(s string) (time.Time, error) {
	t, err := time.Parse(time.RFC3339, s)
	if err == nil {
		return t, nil
	}
	t, err = time.Parse(s, "2006-01-02")
	if err == nil {
		return t, nil
	}
	// TODO: more formats?
	return time.Now(), err
}

func readNote(path string) *Note {
	f, err := os.Open(path)
	u.PanicIfErr(err)
	defer f.Close()

	n := &Note{}
	n.IsPublic = true
	if rand.Intn(100) < 30 {
		// make 30% private, for testing
		n.IsPublic = false
	}
	r := bufio.NewReader(f)
	for {
		l, err := r.ReadString('\n')
		u.PanicIfErr(err)
		l = strings.TrimSpace(l)
		if isSepLine(l) {
			break
		}
		parts := strings.SplitN(l, ":", 2)
		if len(parts) != 2 {
			log.Fatalf("Unexpected line: %q\n", l)
		}
		k := strings.ToLower(parts[0])
		v := strings.TrimSpace(parts[1])
		switch k {
		case "deleted":
			n.IsDeleted = true
		case "draft":
			n.IsPublic = false
		case "id":
		case "title":
			n.Title = v
		case "tags":
			n.Tags = parseTags(v)
		case "format":
			f := parseFormat(v)
			if f == formatInvalid {
				log.Printf("unsupported format '%s'", v)
				return nil
			}
			n.Format = f
		case "date":
			d, err := parseDate(v)
			u.PanicIfErr(err)
			n.CreatedAt = d
		default:
			log.Fatalf("Unexpected key: %q\n", k)
			return nil
		}
	}
	d, err := ioutil.ReadAll(r)
	u.PanicIfErr(err)
	n.Content = d
	return n
}

func writeNotes(path string, notes []*Note) {
	f, err := os.Create(path)
	u.PanicIfErr(err)
	defer f.Close()
	enc := json.NewEncoder(f)
	for _, n := range notes {
		err := enc.Encode(n)
		u.PanicIfErr(err)
	}
	fmt.Printf("wrote notes as json to '%s'\n", path)
}

func main() {
	var flgDir string
	var flgOutFile string

	flag.StringVar(&flgDir, "dir", "", "")
	flag.StringVar(&flgOutFile, "out", "", "")
	flag.Parse()

	if flgDir == "" {
		log.Fatalf("Missing -dir argument\n")
	}
	if flgOutFile == "" {
		log.Fatalf("Missing -out argument\n")
	}

	var files []string
	dirsToVisit := []string{flgDir}
	for len(dirsToVisit) > 0 {
		dir := dirsToVisit[0]
		dirsToVisit = dirsToVisit[1:]
		entries, err := ioutil.ReadDir(dir)
		u.PanicIfErr(err)
		for _, fi := range entries {
			name := fi.Name()
			if fi.IsDir() {
				path := filepath.Join(dir, name)
				dirsToVisit = append(dirsToVisit, path)
				continue
			}
			if strings.HasSuffix(name, ".md") {
				path := filepath.Join(dir, name)
				files = append(files, path)
			}
		}
	}
	if len(files) == 0 {
		fmt.Printf("no files to import\n")
		return
	}
	fmt.Printf("%d posts to import\n", len(files))

	var notes []*Note
	for _, path := range files {
		n := readNote(path)
		if n != nil {
			notes = append(notes, n)
		}
	}
	if len(notes) == 0 {
		fmt.Printf("no notes to import\n")
		return
	}

	fmt.Printf("importing %d notes\n", len(notes))
	writeNotes(flgOutFile, notes)
}
