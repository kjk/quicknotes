package main

import (
	"database/sql"

	"github.com/kjk/log"
)

const (
	sql10 = `
CREATE TABLE simplenote_imports (
  note_id             INT NOT NULL PRIMARY KEY,
  user_id             INT NOT NULL,
  simplenote_id       VARCHAR(128) NOT NULL,
  simplenote_version  VARCHAR(128) NOT NULL,
  INDEX(user_id),
  FOREIGN KEY fk_user_ud(user_id)
    REFERENCES users(id)
    ON DELETE CASCADE,
  FOREIGN KEY fk_note_id(note_id)
    REFERENCES notes(id)
    ON DELETE CASCADE
);
`
)

// DbMigration describes a db migration
type DbMigration struct {
	No  int
	SQL string
}

var (
	migrations = []DbMigration{
		{10, sql10},
	}
)

func execMigration(db *sql.DB, mi *DbMigration) error {
	log.Verbosef("Executing migration %d\n", mi.No)
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	stmts := dbSplitMultiStatements(mi.SQL)
	for _, stm := range stmts {
		_, err = tx.Exec(stm)
		if err != nil {
			log.Errorf("tx.Exec('%s') failed with '%s'\n", stm, err)
			tx.Rollback()
			return err
		}
		log.Verbosef("executed '%s'\n", stm)
	}
	q := `INSERT INTO db_migrations (version) VALUES (?)`
	_, err = tx.Exec(q, mi.No)
	if err != nil {
		log.Errorf("tx.Exec('%s') failed with '%s'\n", q, err)
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

func upgradeDb(db *sql.DB) error {
	var unused int
	for _, mi := range migrations {
		q := `SELECT 1 FROM db_migrations WHERE version = ?`
		err := db.QueryRow(q, mi.No).Scan(&unused)
		switch {
		case err == sql.ErrNoRows:
			err = execMigration(db, &mi)
			if err != nil {
				return err
			}
		case err != nil:
			log.Errorf("db.Query('%s') failed with %s\n", q, err)
			return err
		}
	}
	return nil
}
