#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

npm install
./node_modules/.bin/typings install
