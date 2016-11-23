#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

. scripts/lint.sh

rm -rf s/dist/*.map s/dist/*.js s/dist/*.css tsbuild/ resources.go

./node_modules/.bin/gulp prod

go run tools/gen_resources.go

go build -race -o quicknotes_prod -tags embeded_resources

IFS=\; read -a ip_port <<<"`./scripts/start_docker.py`"
ip="${ip_port[0]}"
port="${ip_port[1]}"

echo "starting quicknotes, using mysql from docker"
./quicknotes_prod -local -verbose -db-host ${ip} -db-port ${port} $@ || true
rm ./quicknotes_prod
