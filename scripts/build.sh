#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

echo "running fmt"
./node_modules/.bin/esformatter -i js/*js* *.js

. scripts/lint.sh

echo "running gulp default"
./node_modules/.bin/gulp default

gdep go build -o quicknotes
#gdep go build -race
rm quicknotes
