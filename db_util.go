package main

import (
	"database/sql"
	"strings"
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
func (v *DbVals) Add(name string, val interface{}) *DbVals {
	v.ColNames = append(v.ColNames, name)
	v.ColValues = append(v.ColValues, val)
	return v
}

func (v *DbVals) genInsertQuery() string {
	n := len(v.ColNames)
	s := "INSERT INTO " + v.TableName + "\n("
	s += strings.Join(v.ColNames, ", ")
	s += ")\nVALUES\n("
	for i := 0; i < n; i++ {
		if i == n-1 {
			s += "?"
		} else {
			s += "?, "
		}
	}
	s += ")\n"
	return s
}

// TxInsert executes an insert within a transaction
func (v *DbVals) TxInsert(tx *sql.Tx) (sql.Result, error) {
	v.Query = v.genInsertQuery()
	return tx.Exec(v.Query, v.ColValues...)
}

// Insert executes an insert
func (v *DbVals) Insert(db *sql.DB) (sql.Result, error) {
	v.Query = v.genInsertQuery()
	return db.Exec(v.Query, v.ColValues...)
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
