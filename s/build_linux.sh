#!/bin/bash
set -u -e -o pipefail -o verbose

. s/lint.sh

. s/install-deps.sh

rm -rf static/dist/*.map static/dist/*.js static/dist/*.css quicknotes_resources.zip

./node_modules/.bin/gulp prod

go run tools/gen_resources.go

GOOS=linux GOARCH=amd64 go build -o quicknotes_linux -ldflags "-X main.sha1ver=`git rev-parse HEAD`"
