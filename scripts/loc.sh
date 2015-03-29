#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

wc -l s/*.html
echo && wc -l jsx/*.jsx jsx/*.js
echo && wc -l *.go
