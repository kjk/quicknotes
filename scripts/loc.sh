#!/bin/bash
set -u -e -o pipefail

rm -f resources.go
wc -l s/*.html sass/*.sass sass/*.scss
echo && wc -l ts/*.ts*
echo && wc -l *.go
