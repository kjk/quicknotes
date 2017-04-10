#!/bin/bash
set -u -e -o pipefail

# . ./scripts/docker_build.sh

IFS=\; read -a ip_port <<<"`./scripts/start_docker.py`"
ip="${ip_port[0]}"
port="${ip_port[1]}"

echo "starting docker quicknotes, using mysql from docker"

docker run --rm -it -v ~/data/quicknotes:/data/quicknotes -p 80:5111 quicknotes:latest /app/quicknotes -verbose -use-resources-zip -db-host ${ip} -db-port ${port} -http-addr=:80


