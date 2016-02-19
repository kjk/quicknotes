#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

. scripts/fmt.sh
. scripts/lint.sh

echo "running gulp default"
./node_modules/.bin/gulp default

echo "go build"
gdep go build -race -o quicknotes

#go build -o quicknotes
#gdep go build -race -o quicknotes

echo "starting quicknotes"
./quicknotes -local $@ || true
rm quicknotes
