#!/bin/bash
set -u -e -o pipefail

cd ./electron
./node_modules/.bin/electron . $@
