#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

ansible-playbook ansible/deploy.yml
