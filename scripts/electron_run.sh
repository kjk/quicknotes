#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

cd ./electron
./node_modules/.bin/electron . $@
