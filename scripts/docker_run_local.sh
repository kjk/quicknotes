#!/bin/bash
set -u -e -o pipefail

. ./scripts/docker_build.sh

docker run --rm -it -v ~/data/blog:/data -p 5020:80 blog:latest
