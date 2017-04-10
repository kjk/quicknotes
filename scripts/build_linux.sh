#!/bin/bash
set -u -e -o pipefail -o verbose

. scripts/lint.sh

. scripts/update-deps.sh

rm -rf s/dist/*.map s/dist/*.js s/dist/*.css resources.go

./node_modules/.bin/gulp prod

go run tools/gen_resources.go

GOOS=linux GOARCH=amd64 go build -o quicknotes_prod_linux -tags embeded_resources
