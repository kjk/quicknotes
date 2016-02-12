package main

import (
	"database/sql"
	"strings"

	"github.com/kjk/log"
)

var (
	questionMarks = [...]string{"?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?"}
)

// DbVals represents list of column names and their values
// for inserting a new database row
type DbVals struct {
	TableName string
	ColNames  []string
	ColValues []interface{}
	Query     string
}

// NewDbVals creates DbVals with n being a hint for capacity
func NewDbVals(tableName string, n int) *DbVals {
	res := &DbVals{TableName: tableName}
	if n > 0 {
		res.ColNames = make([]string, 0, n)
		res.ColValues = make([]interface{}, 0, n)
	}
	return res
}

// Add adds a new name/value pair
// Note: supports up to 16 (len(questionMarks)) columns
func (v *DbVals) Add(name string, val interface{}) *DbVals {
	v.ColNames = append(v.ColNames, name)
	v.ColValues = append(v.ColValues, val)
	return v
}

// generates INSERT INTO foo (col1, col2, col3, ...) VALUES (?, ?, ?, ...)
func (v *DbVals) genInsertQuery() string {
	n := len(v.ColNames)
	s := "INSERT INTO " + v.TableName + "\n("
	s += strings.Join(v.ColNames, ", ")
	s += ")\nVALUES\n("
	s += strings.Join(questionMarks[:n], ", ")
	return s + ")\n"
}

// TxInsert executes an insert within a transaction
func (v *DbVals) TxInsert(tx *sql.Tx) (sql.Result, error) {
	v.Query = v.genInsertQuery()
	res, err := tx.Exec(v.Query, v.ColValues...)
	if err != nil {
		log.Errorf("tx.Exec('%s', %v) failed with '%s'\n", v.Query, v.ColValues, err)
	}
	return res, err
}

// Insert executes an insert
func (v *DbVals) Insert(db *sql.DB) (sql.Result, error) {
	v.Query = v.genInsertQuery()
	res, err := db.Exec(v.Query, v.ColValues...)
	if err != nil {
		log.Errorf("db.Exec('%s', %v) failed with '%s'\n", v.Query, v.ColValues, err)
	}
	return res, err
}

func dbSplitMultiStatements(s string) []string {
	a := strings.Split(s, ");\n\n")
	var res []string
	for _, s := range a {
		s = strings.TrimSpace(s)
		if len(s) == 0 {
			continue
		}
		if !strings.HasSuffix(s, ");") {
			s += ");"
		}
		res = append(res, s)
	}
	return res
}
