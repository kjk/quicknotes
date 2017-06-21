#!/bin/bash
set -u -e -o pipefail -o verbose

go build -o quicknotes -ldflags "-X main.sha1ver=`git rev-parse HEAD`"
