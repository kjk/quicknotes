#!/bin/bash

./node_modules/.bin/prettier --single-quote --trailing-comma es5 --parser typescript --print-width 100 --write "ts/*ts*"
