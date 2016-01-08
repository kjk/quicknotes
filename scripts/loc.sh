#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

wc -l s/*.html sass/*.sass sass/*.scss
echo && wc -l js/*.js*
echo && wc -l *.go
