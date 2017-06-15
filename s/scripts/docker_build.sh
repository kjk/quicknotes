#!/bin/bash
set -u -e -o pipefail -o verbose

. ./s/build_linux.sh

docker build --no-cache --tag quicknotes:latest .

rm quicknotes_linux
