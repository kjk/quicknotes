#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

gdep go tool vet -printfuncs=LogInfof,LogErrorf,LogVerbosef .
gdep go build -o quicknotes
#gdep go build -race -o quicknotes
./quicknotes -local $@ || true
rm quicknotes
