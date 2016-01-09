#!/bin/bash

./node_modules/.bin/eslint js/*.js*

gdep go vet github.com/kjk/quicknotes

#echo "go vet"
#go tool vet -printfuncs=LogInfof,LogErrorf,LogVerbosef .
#go tool vet -printfuncs=LogInfof,LogErrorf,LogVerbosef .
