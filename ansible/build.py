#!/usr/bin/env python

import os, sys, shutil,zipfile, subprocess

pj = os.path.join

script_dir = os.path.realpath(os.path.dirname(__file__))

gopath = os.environ["GOPATH"]
src_dir = os.path.dirname(script_dir)

assert os.path.exists(src_dir), "%s doesn't exist" % src_dir
assert os.path.exists(pj(src_dir, "main.go")), "%s doesn't exist" % pj(src_dir, "main.go")

def abort(s):
    print(s)
    sys.exit(1)

def git_ensure_clean():
    out = subprocess.check_output(["git", "status", "--porcelain"])
    if len(out) != 0:
        print("won't deploy because repo has uncommitted changes:")
        print(out)
        sys.exit(1)

def git_trunk_sha1():
    return subprocess.check_output(["git", "log", "-1", "--pretty=format:%H"])

def add_dir_files(zip_file, dir, dirInZip=None):
    if not os.path.exists(dir):
        abort("dir '%s' doesn't exist" % dir)
    for (path, dirs, files) in os.walk(dir):
        for f in files:
            p = os.path.join(path, f)
            zipPath = None
            if dirInZip is not None:
                zipPath = dirInZip + p[len(dir):]
                #print("Adding %s as %s" % (p, zipPath))
                zip_file.write(p, zipPath)
            else:
                zip_file.write(p)


def zip_files(zip_path):
    zf = zipfile.ZipFile(zip_path, mode="w", compression=zipfile.ZIP_DEFLATED)
    zf.write("quicknotes_prod_linux", "quicknotes")
    zf.write(pj("scripts", "server_run.sh"), "server_run.sh")
    add_dir_files(zf, "s")
    zf.close()

if __name__ == "__main__":
    os.chdir(src_dir)
    git_ensure_clean()
    subprocess.check_output("./scripts/build_linux.sh")
    sha1 = git_trunk_sha1()
    zip_name = sha1 + ".zip"
    zip_path = os.path.join(src_dir, zip_name)
    if os.path.exists(zip_path):
        os.remove(zip_path)
    zip_files(zip_path)
    os.remove("quicknotes_prod_linux")
    os.chdir(script_dir)
    if os.path.exists(zip_name):
        os.remove(zip_name)
    os.rename(zip_path, zip_name)
