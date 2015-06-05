#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

go tool vet .
go build -o quicknotes
#go build -race -o quicknotes
./quicknotes -local -recreatedb || true
rm quicknotes
