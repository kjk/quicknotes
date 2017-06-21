#!/bin/bash
set -ue -o pipefail -o verbose

go build -o quicknotes

./quicknotes -db-host 192.168.99.100 -db-port 7200 -show-note "$@" || true
rm quicknotes
