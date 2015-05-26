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

func main() {
	readUsers()
}
