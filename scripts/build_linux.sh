#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

gdep go tool vet -printfuncs=httpErrorf:1,Noticef,Errorf .
GOOS=linux GOARCH=amd64 gdep go build -o quicknotes_linux
