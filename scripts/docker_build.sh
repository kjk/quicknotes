#!/bin/bash
set -u -e -o pipefail -o verbose

. ./scripts/build_linux.sh

docker build --no-cache --tag quicknotes:latest .

rm quicknotes_linux
