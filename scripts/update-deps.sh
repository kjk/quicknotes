#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

rm -rf node_modules
rm -rf typings

yarn
./node_modules/.bin/typings install

# this patches highlight.js in node_modules to only include a subset of
# languages for a significant saving in final bundle (1.3 MB => 879 K)
cp ./scripts/highlight_index_override.js ./node_modules/highlight.js/lib/index.js
