#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

# ansible_ssh_private_key_file=$HOME/.ssh/id_rsa_apptranslator
#ansible sumatrawebsite -m ping
cd ansible
ansible-playbook initial-setup.yml
