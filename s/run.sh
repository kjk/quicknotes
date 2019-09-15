#!/bin/bash
set -u -e -o pipefail -o verbose

# . s/fmt.sh
# . s/lint.sh

#echo "running gulp default"
#./node_modules/.bin/gulp default

go build -race -o quicknotes -ldflags "-X main.sha1ver=`git rev-parse HEAD`"
#go build -o quicknotes -ldflags "-X main.sha1ver=`git rev-parse HEAD`"

./quicknotes -verbose $@ || true
rm ./quicknotes
