#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

cd ./electron
rm -rf dist
node ./tools/build.js
