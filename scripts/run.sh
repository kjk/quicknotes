#!/usr/local/bin/python3

import sys, os, os.path, time, subprocess

g_imageName = "quicknotes/mysql-55"
g_containerName = "mysql-55-for-quicknotes"

kStatusRunning = "running"
kStatusExited = "exited"

def print_cmd(cmd):
  print("cmd:" + " ".join(cmd))

def run_cmd(cmd):
  print_cmd(cmd)
  subprocess.run(cmd, check=True)

def run_cmd_out(cmd):
  print_cmd(cmd)
  s = subprocess.check_output(cmd)
  return s.decode("utf-8")

def run_cmd_show_progress(cmd):
  print("Running '%s'" % cmd)
  p = subprocess.Popen(cmd, stdout = subprocess.PIPE,
          stderr = subprocess.STDOUT, shell = True)
  while True:
    line = p.stdout.readline()
    if not line:
      break
    sys.stdout.buffer.write(line)
    sys.stdout.flush()
  #print("Finished runnign '%s'" % " ".join(cmd))

def verify_docker_running():
  try:
    run_cmd(["docker", "ps"])
  except:
    print("docker is not running! must run docker")
    sys.exit(10)

def get_docker_machine_ip():
  ip = run_cmd_out(["docker-machine", "ip", "default"])
  return ip.strip()

# returns container id and status (running, exited) for a container
# started with a given name
# returns None if no container of that name
def docker_ps(containerName):
  s = run_cmd_out(["docker", "ps", "-a"])
  lines = s.split("\n")
  #print(lines)
  if len(lines) < 2:
    return (None, None)
  lines = lines[1:]
  for l in lines:
    # imperfect heuristic
    if containerName in l:
      status = kStatusRunning
      # probably imperfect heuristic
      if "Exited" in l:
        status = kStatusExited
      parts = l.split()
      return (parts[0], status)
  return (None, None)

def start_container_if_needed(imageName, containerName, portMapping):
  (containerId, status) = docker_ps(containerName)
  if status == kStatusRunning:
    print("container %s is already running" % containerName)
    return
  if status == kStatusExited:
    cmd = ["docker", "start", containerId]
  else:
    cmd = ["docker", "run", "-d", "--name=" + containerName, "-p", portMapping, imageName]
  run_cmd(cmd)
  wait_for_container(containerName)

def wait_for_container(containerName):
  # 8 secs is a heuristic
  timeOut = 8
  print("waiting %s secs for container to start" % timeOut, end="", flush=True)
  while timeOut > 0:
    print(".", end="", flush=True)
    time.sleep(1)
    timeOut -= 1
  print("")

def main():
  verify_docker_running()
  ip = get_docker_machine_ip()
  start_container_if_needed(g_imageName, g_containerName, "7200:3306")
  cmd = "./scripts/build_and_run.sh -verbose -db-host %s -db-port 7200" % ip
  run_cmd_show_progress(cmd)

if __name__ == "__main__":
  main()
