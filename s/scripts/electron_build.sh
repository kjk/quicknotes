#!/bin/bash
set -u -e -o pipefail

cd ./electron
rm -rf dist
./node_modules/.bin/build
