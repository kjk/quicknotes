#!/bin/bash
set -u -e -o pipefail

. s/fmt.sh
. s/lint.sh

echo "running gulp default"
./node_modules/.bin/gulp default

echo "go build"
go build -race -o quicknotes

#go build -o quicknotes
#go build -race -o quicknotes

echo "starting quicknotes"
./quicknotes -proddb || true
rm quicknotes
