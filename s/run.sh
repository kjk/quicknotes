#!/bin/bash
set -u -e -o pipefail -o verbose

IFS=\; read -a ip_port <<<"`./s/start_docker.py`"
ip="${ip_port[0]}"
port="${ip_port[1]}"

# . s/fmt.sh
# . s/lint.sh

#echo "running gulp default"
#./node_modules/.bin/gulp default

go build -race -o quicknotes -ldflags "-X main.sha1ver=`git rev-parse HEAD`"
#go build -o quicknotes -ldflags "-X main.sha1ver=`git rev-parse HEAD`"

./quicknotes -verbose -db-host ${ip} -db-port ${port} $@ || true
rm ./quicknotes
