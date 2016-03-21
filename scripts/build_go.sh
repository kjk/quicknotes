#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

gdep go vet github.com/kjk/quicknotes
gdep go build -o quicknotes
