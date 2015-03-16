#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

NODE_PATH=/usr/local/lib/node_modules webpack --watch --display-error-details -d
