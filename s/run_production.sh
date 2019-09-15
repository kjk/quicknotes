#!/bin/bash
set -u -e -o pipefail

. s/lint.sh

rm -rf static/dist/*.map static/dist/*.js static/dist/*.css tsbuild/ quicknotes_resources.zip

./node_modules/.bin/gulp prod

go run tools/gen_resources.go

go build -race -o quicknotes_prod -ldflags "-X main.sha1ver=`git rev-parse HEAD`"

echo "starting quicknotes"
./quicknotes_prod -verbose -use-resources-zip $@ || true
rm ./quicknotes_prod
