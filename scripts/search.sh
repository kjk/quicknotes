#!/bin/bash
set -u -e -o pipefail

echo "go build"
go build -o quicknotes

echo "starting quicknotes, using mysql from docker"
./quicknotes -search-local "$@" || true
rm quicknotes
