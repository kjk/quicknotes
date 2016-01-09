#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail
set -o verbose

. scripts/lint.sh

rm -rf s/dist/*.map s/dist/*.js s/dist/*.css resources.go

./node_modules/.bin/gulp prod

go run tools/gen_resources.go

gdep go build -o quicknotes_prod -tags embeded_resources
