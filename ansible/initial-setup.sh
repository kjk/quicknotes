#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

export ANSIBLE_HOST_KEY_CHECKING=False

# ansible_ssh_private_key_file=$HOME/.ssh/id_rsa_apptranslator
#ansible quicknotes-initial -m ping
cd ansible
ansible-playbook initial-setup.yml
