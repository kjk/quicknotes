#!/bin/bash
set -u -e -o pipefail

. s/lint.sh

rm -rf s/dist/*.map s/dist/*.js s/dist/*.css tsbuild/ quicknotes_resources.zip

./node_modules/.bin/gulp prod

go run tools/gen_resources.go

go build -race -o quicknotes_prod

IFS=\; read -a ip_port <<<"`./s/start_docker.py`"
ip="${ip_port[0]}"
port="${ip_port[1]}"

echo "starting quicknotes, using mysql from docker"
./quicknotes_prod -verbose -use-resources-zip -db-host ${ip} -db-port ${port} $@ || true
rm ./quicknotes_prod
