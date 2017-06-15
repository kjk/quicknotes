#!/bin/bash
set -u -e -o pipefail

echo "go build"
go build -o quicknotes

./quicknotes -db-host 192.168.99.100 -db-port 7200 -show-note "$@" || true
rm quicknotes
