#!/bin/bash
set -u -e -o pipefail -o verbose

rm -f static/dist/*
./node_modules/.bin/gulp prod
ls -la static/dist
