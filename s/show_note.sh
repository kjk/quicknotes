#!/bin/bash
set -ue -o pipefail -o verbose

go build -o quicknotes

./quicknotes -show-note "$@" || true
rm quicknotes
