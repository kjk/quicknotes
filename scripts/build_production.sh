#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

#. scripts/fmt.sh
. scripts/lint.sh

rm -rf s/dist/*.map s/dist/*.js s/dist/*.css

echo "running gulp prod"
./node_modules/.bin/gulp prod

echo "running tools/gen_resources.go"
go run tools/gen_resources.go

echo "go build"
gdep go build -tags embedded_resources -o quicknotes
