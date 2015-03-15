#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

cd $GOPATH/src/github.com/kjk/quicknotes
git log -1 --pretty=format:%H
