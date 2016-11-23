#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

IFS=\; read -a ip_port <<<"`./scripts/start_docker.py`"
ip="${ip_port[0]}"
port="${ip_port[1]}"

. scripts/fmt.sh
. scripts/lint.sh

#echo "running gulp default"
#./node_modules/.bin/gulp default

echo "go build"
go build -race -o quicknotes

#go build -o quicknotes
#go build -race -o quicknotes

echo "starting quicknotes, using mysql from docker"
./quicknotes -local -verbose -db-host ${ip} -db-port ${port} $@ || true
rm ./quicknotes
