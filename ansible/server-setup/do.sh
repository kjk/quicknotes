#!/bin/bash
set -u -e -o pipefail

export ANSIBLE_HOST_KEY_CHECKING=False

# ansible_ssh_private_key_file=$HOME/.ssh/id_rsa_apptranslator
#ansible quicknotes-initial -m ping
cd ansible/server-setup
ansible-playbook -i inventory server-setup.yml
