#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

IFS=\; read -a ip_port <<<"`./scripts/start_docker.py`"
ip="${ip_port[0]}"
port="${ip_port[1]}"

. scripts/build_production.sh

echo "starting quicknotes, using mysql from docker"
./quicknotes_prod -local -verbose -db-host ${ip} -db-port ${port} $@ || true
