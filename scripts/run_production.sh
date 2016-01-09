#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

. scripts/build_production.sh

echo "starting quicknotes, using mysql from docker"
./quicknotes_prod -local $@ || true
