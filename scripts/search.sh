#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

echo "go build"
gdep go build -o quicknotes

echo "starting quicknotes, using mysql from docker"
./quicknotes -local -search-local $@ || true
rm quicknotes
