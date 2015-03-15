#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

go tool vet .
go build -o notenik
#go build -race -o notenik
./notenik -local -recreatedb || true
rm notenik
