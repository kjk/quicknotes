#!/bin/bash
set -u -e -o pipefail

rm -rf vendor
dep ensure

# TODO: ideally we should delete to be extra sure it's clean
# but sass compiler takes forever to install (builds C++)
#rm -rf node_modules
rm -rf typings

yarn
./node_modules/.bin/typings install

# this patches highlight.js in node_modules to only include a subset of
# languages for a significant saving in final bundle (1.3 MB => 879 K)
cp ./scripts/highlight_index_override.js ./node_modules/highlight.js/lib/index.js
