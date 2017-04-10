#!/bin/bash
set -u -e -o pipefail -o verbose

. ./scripts/build_linux.sh

docker build --tag quicknotes:latest .
