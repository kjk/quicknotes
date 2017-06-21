#!/bin/bash
set -u -e -o pipefail -o verbose

go build -o quicknotes

./quicknotes -search-local "$@" || true
rm quicknotes
