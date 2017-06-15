#!/bin/bash
set -u -e -o pipefail

go tool vet .
go build -o quicknotes
#go build -race -o quicknotes
./quicknotes -import-stack-overflow || true
rm quicknotes
