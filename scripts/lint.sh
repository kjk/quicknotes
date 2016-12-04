#!/bin/bash

./node_modules/.bin/tslint ts/*.ts*

go vet github.com/kjk/quicknotes

#echo "go vet"
#go tool vet -printfuncs=LogInfof,LogErrorf,LogVerbosef .
#go tool vet -printfuncs=LogInfof,LogErrorf,LogVerbosef .
