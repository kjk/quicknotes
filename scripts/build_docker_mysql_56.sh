#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

# ensure that docker is running
docker ps

ndocker build -t quicknotes/mysql-56 -f scripts/mysql-56.dockerfile .
