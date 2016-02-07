#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

echo "go build"
gdep go build -o quicknotes

./quicknotes -local -db-host 192.168.99.100 -db-port 7200 -show-note "$@" || true
rm quicknotes
