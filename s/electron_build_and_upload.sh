#!/bin/bash
set -u -e -o pipefail

cd ./electron
rm -rf dist
go run ./tools/build.go

