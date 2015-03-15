#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

cd /home/quicknotes/www/app/current
exec ./quicknotes "$@" &>>crash.log
