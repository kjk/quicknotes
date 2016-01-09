#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

. scripts/fmt.sh

. scripts/lint.sh

echo "go build"
gdep go build -o quicknotes

#go build -o quicknotes
#gdep go build -race -o quicknotes

echo "starting quicknotes, using mysql from docker"
./quicknotes -local $@ || true
rm quicknotes
