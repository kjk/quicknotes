#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

go tool vet -printfuncs=LogInfof,LogErrorf,LogVerbosef .
