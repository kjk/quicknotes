#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

. scripts/build_production.sh

#go build -o quicknotes
#gdep go build -race -o quicknotes

echo "starting quicknotes, using mysql from docker"
./quicknotes -local $@ || true
#rm quicknotes
