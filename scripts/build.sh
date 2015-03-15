#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

gdep go build -o quicknotes
#gdep go build -race
rm quicknotes
