#!/bin/bash
set -u -e -o pipefail

cd ansible/deploy
ansible-playbook -i inventory deploy.yml
