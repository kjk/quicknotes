package main

import (
	"fmt"
	"time"

	"github.com/kjk/stackoverflow"
	"github.com/kjk/u"
)

type PostCurrentState struct {
	ID        int
	Body      string
	Title     string
	Tags      []string // TODO: perf, store as string with RS as separator
	CreatedAt time.Time
}

const (
	ChangeInitial = 1
	ChangeBody    = 2
	ChangeTitle   = 3
	ChangeTags    = 4
)

type PostStateChange struct {
	Post       *PostCurrentState
	ChangeType int
	Comment    string
	CreatedAt  time.Time
}

type PostHistoryIterator struct {
	r                           *stackoverflow.Reader
	CurrentChange               PostStateChange
	err                         error
	postsArr                    []PostCurrentState
	posts                       map[int]int
	incompletePosts             []int // index into postsArr
	NumChanges                  int
	NumSkipped                  int
	NumSkippedInvalidUser       int
	NumSkippedEmpty             int
	NumSkippedUnexpectedInitial int
	cached                      []stackoverflow.PostHistory
	noMore                      bool
}

func init() {
	importDataDir = u.ExpandTildeInPath("~/data/import_stack_overflow")
}

func NewPostHistoryIterator(r *stackoverflow.Reader) (*PostHistoryIterator, error) {
	return &PostHistoryIterator{
		r:     r,
		posts: make(map[int]int),
	}, nil
}

func (i *PostHistoryIterator) next() *stackoverflow.PostHistory {
	if i.err != nil {
		return nil
	}
	if len(i.cached) > 0 {
		res := i.cached[0]
		i.cached = i.cached[1:]
		return &res
	}
	if i.noMore {
		return nil
	}
	if !i.r.Next() {
		i.noMore = true
		return nil
	}
	return &i.r.PostHistory
}

func (i *PostHistoryIterator) RemovePeeked(n int) {
	a := i.cached
	i.cached = append(a[:n], a[n+1:]...)
}

// this should always be called in sequence, starting from 0
func (i *PostHistoryIterator) PeekIt(n int) *stackoverflow.PostHistory {
	if i.err != nil {
		return nil
	}
	if n < len(i.cached) {
		return &i.cached[n]
	}
	if i.noMore {
		return nil
	}
	if !i.r.Next() {
		i.noMore = true
		return nil
	}
	i.cached = append(i.cached, i.r.PostHistory)
	return &i.cached[n]
}

func hasTitleAndBody(p *PostCurrentState) bool {
	return len(p.Title)+len(p.Body) != 0
}

func setInitialValue2(ph *stackoverflow.PostHistory, p *PostCurrentState) {
	switch ph.PostHistoryTypeID {
	case stackoverflow.HistoryInitialTitle:
		p.Title = ph.Text
	case stackoverflow.HistoryInitialBody:
		p.Body = ph.Text
	case stackoverflow.HistoryInitialTags:
		p.Tags = ph.Tags
	default:
		//fmt.Printf("\nrevguid: %s, type: %d, id: %d", ph.RevisionGUID, ph.PostHistoryTypeID, ph.PostID)
		//panic("invalid type")
	}
}

// Next returns false when finished
func (i *PostHistoryIterator) Next() bool {
	if i.err != nil {
		return false
	}

Next:
	ph := i.next()
	if ph == nil {
		return false
	}

	if !isValidType(ph.PostHistoryTypeID) {
		i.NumSkipped++
		goto Next
	}

	if ph.UserID == -1 || ph.UserID == 0 {
		i.NumSkipped++
		i.NumSkippedInvalidUser++
		goto Next
	}

	if ph.Text == "" {
		i.NumSkipped++
		i.NumSkippedEmpty++
		goto Next
	}

	postID := ph.PostID
	if isInitialType(ph.PostHistoryTypeID) {
		revGUID := ph.RevisionGUID
		_, ok := i.posts[postID]
		if ok {
			// skipping because shouldn't have seen the post id
			i.NumSkipped++
			i.NumSkippedUnexpectedInitial++
			fmt.Printf("\nunexpected initial: %s", revGUID)
			goto Next
		}
		post := PostCurrentState{
			ID:        postID,
			CreatedAt: ph.CreationDate,
		}
		setInitialValue2(ph, &post)
		nSeen := 1
		// for efficiency, try to construct initial note by peeking the values
		for n := 0; n < 50 && nSeen < 3; n++ {
			ph = i.PeekIt(n)
			if ph == nil {
				break
			}
			if ph.RevisionGUID == revGUID {
				nSeen++
				setInitialValue2(ph, &post)
				i.RemovePeeked(n)
				n--
			}
		}
		if !hasTitleAndBody(&post) {
			i.NumSkipped++
			fmt.Printf("\npost %d has no title or body", postID)
			goto Next
		}
		idx := len(i.posts)
		i.postsArr = append(i.postsArr, post)
		i.posts[postID] = idx
		i.CurrentChange.ChangeType = ChangeInitial
		i.CurrentChange.Post = &i.postsArr[idx]
		i.CurrentChange.CreatedAt = post.CreatedAt
		i.NumChanges++
		return true
	}

	idx, ok := i.posts[postID]
	if !ok {
		i.NumSkipped++
		//fmt.Printf("\nchange %s for post %d skipped because post missing", ph.RevisionGUID, postID)
		goto Next
	}
	post := &i.postsArr[idx]
	i.CurrentChange.Post = post
	i.CurrentChange.CreatedAt = ph.CreationDate
	i.CurrentChange.Comment = ph.Comment
	switch ph.PostHistoryTypeID {
	case stackoverflow.HistoryEditTitle,
		stackoverflow.HistoryRollbackTitle:
		if post.Title == ph.Text {
			i.NumSkipped++
			//fmt.Printf("\nchange %s for post %d skipped because new title is the same", ph.RevisionGUID, postID)
			goto Next
		}
		post.Title = ph.Text
		i.CurrentChange.ChangeType = ChangeTitle
	case stackoverflow.HistoryEditBody,
		stackoverflow.HistoryRollbackBody:
		if post.Body == ph.Text {
			i.NumSkipped++
			//fmt.Printf("\nchange %s for post %d skipped because new body is the same", ph.RevisionGUID, postID)
			goto Next
		}
		post.Body = ph.Text
		i.CurrentChange.ChangeType = ChangeBody
	case stackoverflow.HistoyrEditTags,
		stackoverflow.HistoryRollbackTags:
		post.Tags = ph.Tags
		i.CurrentChange.ChangeType = ChangeTags
	}

	i.NumChanges++
	return true
}

func (i *PostHistoryIterator) Err() error {
	return i.err
}

func importStackOverflow2() {
	siteName := "academia"
	fmt.Printf("loading site %s...", siteName)
	timeStart := time.Now()

	hr := getHistoryReader(siteName)
	i, err := NewPostHistoryIterator(hr)
	u.PanicIfErr(err, "NewPostHistoryIterator()")
	nChanges := 0
	toPrint := 100
	for i.Next() {
		nChanges++
		toPrint--
		if toPrint < 0 {
			continue
		}
		curr := &i.CurrentChange
		p := curr.Post
		switch curr.ChangeType {
		case ChangeInitial:
			fmt.Printf("---Title %d: %s\nBody:%s\n", p.ID, p.Title, p.Body)
			if len(p.Tags) > 0 {
				fmt.Printf("Tags: %v\n", p.Tags)
			}
		case ChangeTitle:
			fmt.Printf("Title %d: %s\n", p.ID, p.Title)
		case ChangeBody:
			fmt.Printf("Body %d: %s\n", p.ID, p.Body)
		case ChangeTags:
			fmt.Printf("Tags %d: %v\n", p.ID, p.Tags)
		}
	}
	if err := i.Err(); err != nil {
		fmt.Printf("i.Err(): %s\n", i.Err())
	}
	fmt.Printf(" done in %s\n", time.Since(timeStart))
	fmt.Printf("Total changes: %d, skipped: %d (because empty: %d, because invalid user: %d)\n", i.NumChanges, i.NumSkipped, i.NumSkippedEmpty, i.NumSkippedInvalidUser)
	fmt.Printf("Posts: %d, post changes: %d\n", len(i.postsArr), nChanges)
	dumpMemStats()
}
