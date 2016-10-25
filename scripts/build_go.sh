#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

go vet github.com/kjk/quicknotes
go build -o quicknotes
