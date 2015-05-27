package main

import (
	"fmt"
	"path/filepath"
	"time"

	"github.com/kjk/u"
)

func readUsers(dataDir string) []User {
	dir := u.ExpandTildeInPath(dataDir)
	fmt.Printf("readUsers: dir=%s\n", dir)
	path := filepath.Join(dir, "Users.xml")
	timeStart := time.Now()
	ur, err := NewUsersReader(path)
	if err != nil {
		fmt.Printf("readUsers: NewUsersReader() failed with %s\n", err)
		return nil
	}
	var res []User
	for ur.Next() {
		res = append(res, ur.User)
	}
	if ur.Err() != nil {
		fmt.Printf("readUsers: Next() failed with '%s'\n", ur.Err())
	}
	fmt.Printf("loaded %d users in %s\n", len(res), time.Since(timeStart))
	return res
}

func readPosts(dataDir string) []Post {
	dir := u.ExpandTildeInPath(dataDir)
	fmt.Printf("readPosts: dir=%s\n", dir)
	path := filepath.Join(dir, "Posts.xml")
	timeStart := time.Now()
	ur, err := NewPostsReader(path)
	if err != nil {
		fmt.Printf("readPosts: NewPostsReader() failed with %s\n", err)
		return nil
	}
	var res []Post
	for ur.Next() {
		res = append(res, ur.Post)
	}
	if ur.Err() != nil {
		fmt.Printf("readPosts: Next() failed with '%s'\n", ur.Err())
	}
	nQuestions := 0
	nAnswers := 0
	tags := map[string]int{}
	for _, p := range res {
		if p.PostTypeID == PostTypeQuestion {
			nQuestions++
		} else if p.PostTypeID == PostTypeAnswer {
			nAnswers++
		}
		for _, tag := range p.Tags {
			tags[tag]++
		}
	}
	fmt.Printf("loaded %d posts (%d questions, %d answers, %d unique tags) in %s\n", len(res), nQuestions, nAnswers, len(tags), time.Since(timeStart))
	return res
}

func readComments(dataDir string) []Comment {
	dir := u.ExpandTildeInPath(dataDir)
	fmt.Printf("readComments: dir=%s\n", dir)
	path := filepath.Join(dir, "Comments.xml")
	timeStart := time.Now()
	ur, err := NewCommentsReader(path)
	if err != nil {
		fmt.Printf("readComments: NewCommentsReader() failed with %s\n", err)
		return nil
	}
	var res []Comment
	for ur.Next() {
		res = append(res, ur.Comment)
	}
	if ur.Err() != nil {
		fmt.Printf("readComments: Next() failed with '%s'\n", ur.Err())
	}
	fmt.Printf("loaded %d comments in %s\n", len(res), time.Since(timeStart))
	return res
}

func readTags(dataDir string) []Tag {
	dir := u.ExpandTildeInPath(dataDir)
	fmt.Printf("readTags: dir=%s\n", dir)
	path := filepath.Join(dir, "Tags.xml")
	timeStart := time.Now()
	ur, err := NewTagsReader(path)
	if err != nil {
		fmt.Printf("readTags: NewTagsReader() failed with %s\n", err)
		return nil
	}
	var res []Tag
	for ur.Next() {
		res = append(res, ur.Tag)
	}
	if ur.Err() != nil {
		fmt.Printf("readTags: Next() failed with '%s'\n", ur.Err())
	}
	fmt.Printf("loaded %d tags in %s\n", len(res), time.Since(timeStart))
	return res
}

func readBadges(dataDir string) []Badge {
	dir := u.ExpandTildeInPath(dataDir)
	fmt.Printf("readBadges: dir=%s\n", dir)
	path := filepath.Join(dir, "Badges.xml")
	timeStart := time.Now()
	ur, err := NewBadgesReader(path)
	if err != nil {
		fmt.Printf("readBadges: NewBadgesReader() failed with %s\n", err)
		return nil
	}
	var res []Badge
	for ur.Next() {
		res = append(res, ur.Badge)
	}
	if ur.Err() != nil {
		fmt.Printf("readBadges: Next() failed with '%s'\n", ur.Err())
	}
	fmt.Printf("loaded %d badges in %s\n", len(res), time.Since(timeStart))
	return res
}

func readPostHistory(dataDir string) []PostHistory {
	dir := u.ExpandTildeInPath(dataDir)
	fmt.Printf("readPostHistory: dir=%s\n", dir)
	path := filepath.Join(dir, "PostHistory.xml")
	timeStart := time.Now()
	ur, err := NewPostHistoryReader(path)
	if err != nil {
		fmt.Printf("readPostHistory: NewPostHistoryReader() failed with %s\n", err)
		return nil
	}
	var res []PostHistory
	for ur.Next() {
		res = append(res, ur.PostHistory)
	}
	if ur.Err() != nil {
		fmt.Printf("readPostHistory: Next() failed with '%s'\n", ur.Err())
	}
	fmt.Printf("loaded %d post history entries in %s\n", len(res), time.Since(timeStart))
	return res
}

func readPostLinks(dataDir string) []PostLink {
	dir := u.ExpandTildeInPath(dataDir)
	fmt.Printf("readPostLinks: dir=%s\n", dir)
	path := filepath.Join(dir, "PostLinks.xml")
	timeStart := time.Now()
	ur, err := NewPostLinksReader(path)
	if err != nil {
		fmt.Printf("readPostLinks: NewPostHistoryReader() failed with %s\n", err)
		return nil
	}
	var res []PostLink
	for ur.Next() {
		res = append(res, ur.PostLink)
	}
	if ur.Err() != nil {
		fmt.Printf("readPostLinks: Next() failed with '%s'\n", ur.Err())
	}
	fmt.Printf("loaded %d post links in %s\n", len(res), time.Since(timeStart))
	return res
}

func readVotes(dataDir string) []Vote {
	dir := u.ExpandTildeInPath(dataDir)
	fmt.Printf("readVotes: dir=%s\n", dir)
	path := filepath.Join(dir, "Votes.xml")
	timeStart := time.Now()
	ur, err := NewVotesReader(path)
	if err != nil {
		fmt.Printf("readVotes: NewPostHistoryReader() failed with %s\n", err)
		return nil
	}
	var res []Vote
	for ur.Next() {
		res = append(res, ur.Vote)
	}
	if ur.Err() != nil {
		fmt.Printf("readVotes: Next() failed with '%s'\n", ur.Err())
	}
	fmt.Printf("loaded %d post links in %s\n", len(res), time.Since(timeStart))
	return res
}

func main() {
	//dataDir := "~/data/academia.stackexchange.com"
	dataDir := "~/data/serverfault.com"
	//dataDir := "~/data/stackoverflow"

	//readUsers(dataDir)
	//readPosts(dataDir)
	//readComments(dataDir)
	//readTags(dataDir)
	//readBadges(dataDir)
	//readPostHistory(dataDir)
	//readPostLinks(dataDir)
	readVotes(dataDir)
}
