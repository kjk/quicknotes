#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

# ensure that docker is running
docker ps

docker build -t quicknotes/mysql-56 -f scripts/mysql-56.dockerfile .
