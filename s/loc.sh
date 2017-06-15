#!/bin/bash
set -u -e -o pipefail

wc -l static/*.html sass/*.sass sass/*.scss
echo && wc -l ts/*.ts*
echo && wc -l *.go
