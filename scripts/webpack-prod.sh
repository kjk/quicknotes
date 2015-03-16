#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

rm -rf s/js/bundle.js*
NODE_PATH=/usr/local/lib/node_modules webpack --display-error-details -p
