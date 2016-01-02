#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

echo "running eslint"
./node_modules/.bin/eslint jsx/*.js*

echo "go vet"
go tool vet -printfuncs=LogInfof,LogErrorf,LogVerbosef .

#go tool vet -printfuncs=LogInfof,LogErrorf,LogVerbosef .
echo "go build"
gdep go build -o quicknotes

#go build -o quicknotes
#gdep go build -race -o quicknotes

echo "starging quicknotes"
./quicknotes -local $@ || true
rm quicknotes
