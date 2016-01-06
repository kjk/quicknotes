#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

echo "running eslint"
./node_modules/.bin/eslint jsx/*.js*

echo "running go vet"
gdep go vet github.com/kjk/quicknotes
