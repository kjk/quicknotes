#!/bin/bash
set -u -e -o pipefail -o verbose

IFS=\; read -a ip_port <<<"`./scripts/start_docker.py`"
ip="${ip_port[0]}"
port="${ip_port[1]}"

# . scripts/fmt.sh
# . scripts/lint.sh

#echo "running gulp default"
#./node_modules/.bin/gulp default

go build -race -o quicknotes
#go build -o quicknotes

./quicknotes -verbose -db-host ${ip} -db-port ${port} $@ || true
rm ./quicknotes
