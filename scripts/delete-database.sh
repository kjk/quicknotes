#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

godep go tool vet .
godep go build -o quicknotes
#godep go build -race -o quicknotes
./quicknotes -local -deldb || true
rm quicknotes
