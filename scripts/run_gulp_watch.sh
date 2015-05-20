#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

gulp build_and_watch
