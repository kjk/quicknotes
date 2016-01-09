#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

echo "running eslint"
./node_modules/.bin/eslint js/*.js*

echo "running go vet"
gdep go vet github.com/kjk/quicknotes

#echo "go vet"
#go tool vet -printfuncs=LogInfof,LogErrorf,LogVerbosef .
#go tool vet -printfuncs=LogInfof,LogErrorf,LogVerbosef .
