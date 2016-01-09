#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

echo "running esformatter"
./node_modules/.bin/esformatter -i js/*js*
