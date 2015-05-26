package main

import (
	"fmt"
	"path/filepath"
	"time"

	"github.com/kjk/u"
)

func readUsers() []User {
	dir := u.ExpandTildeInPath("~/data/academia.stackexchange.com")
	fmt.Printf("readUsers: dir=%s\n", dir)
	path := filepath.Join(dir, "Users.xml")
	timeStart := time.Now()
	ur, err := NewUserReader(path)
	if err != nil {
		fmt.Printf("readUsers: NewUserReader() failed with %s\n", err)
		return nil
	}
	var res []User
	for ur.Next() {
		res = append(res, ur.User)
	}
	if ur.Err() != nil {
		fmt.Printf("readUsers: UserReader.Next() failed with '%s'\n", ur.Err())
	}
	fmt.Printf("loaded %d users in %s\n", len(res), time.Since(timeStart))
	return res
}

func readPosts() []Post {
	dir := u.ExpandTildeInPath("~/data/academia.stackexchange.com")
	fmt.Printf("readPosts: dir=%s\n", dir)
	path := filepath.Join(dir, "Posts.xml")
	timeStart := time.Now()
	ur, err := NewPostReader(path)
	if err != nil {
		fmt.Printf("readPosts: NewPostReader() failed with %s\n", err)
		return nil
	}
	var res []Post
	for ur.Next() {
		res = append(res, ur.Post)
	}
	if ur.Err() != nil {
		fmt.Printf("readPosts: PostReader.Next() failed with '%s'\n", ur.Err())
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

func main() {
	readUsers()
	readPosts()
}
