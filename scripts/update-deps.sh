#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

rm -rf node_modules
rm -rf typings

npm install
./node_modules/.bin/typings install
