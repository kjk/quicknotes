#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

cd ansible/deploy
ansible-playbook -i inventory deploy.yml
