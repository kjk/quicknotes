package main

import (
	"database/sql"

	"github.com/kjk/log"
)

// DbMigrations describes a db migration
type DbMigrations struct {
	No  int
	SQL string
}

var (
	migrations = []DbMigrations{}
)

func upgradeDb(db *sql.DB) error {
	var unused int
	for _, mi := range migrations {
		q := `SELECT 1 FROM dbmigrations WHERE version = ?`
		err := db.QueryRow(q, mi.No).Scan(&unused)
		switch {
		case err == sql.ErrNoRows:
			// TODO: execute sql
			//q := `INSERT INTO dbmigrations (version) VALUES (?)``
		case err != nil:
			log.Errorf("db.Query('%s') failed with %s\n", q, err)
			return err
		}
	}
	return nil
}
