#!/usr/bin/env python3

import argparse
import contextlib
import errno
import hashlib
import json
import logging
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import urllib.request
import xml.etree.ElementTree

logging.basicConfig(stream=sys.stdout, format="%(message)s")
log = logging.root

parser = argparse.ArgumentParser("Tool to download an extension")
parser.add_argument("--addon-id", "-a",
                    required=True,
                    help="ID of addon to download",
                    action="append",
                    default=[])
parser.add_argument("--output-directory", "-o",
                    default=os.getcwd(),
                    help="Directory to download to")
parser.add_argument("--verbose", "-v",
                    default=logging.INFO,
                    action="store_const",
                    const=logging.DEBUG,
                    help="Show extra debugging info")
args = parser.parse_args()
log.setLevel(args.verbose)
log.debug("Downloading id %s to %s",
          args.addon_id,
          args.output_directory)

for addon_id in args.addon_id:
    log.info("Downloading addon %s...", addon_id)
    listing_url = "https://addons.mozilla.org/api/v4/addons/addon/{id}/".format(id=addon_id)
    log.debug("Downloading metadata %s...", listing_url)

    with contextlib.closing(urllib.request.urlopen(listing_url)) as json_data:
        log.debug("Established connection %s", json_data)
        listing = json.load(json_data)

    version = listing['current_version']
    file = version['files'][0]
    temp_xpi_fd, temp_xpi = tempfile.mkstemp(suffix=".xpi")
    try:
        log.debug("Downloading to temporary file %s", temp_xpi)
        os.close(temp_xpi_fd)
        subprocess.check_call(["wget", "-t", "0", "-O", temp_xpi, file['url']])
        xpi_hash_alg, xpi_hash_value = file['hash'].split(':', 1)
        hasher = hashlib.new(xpi_hash_alg)
        with open(temp_xpi, "rb") as hash_file:
            while True:
                buf = hash_file.read(4096)
                if len(buf) == 0:
                    break
                hasher.update(buf)
        actual_hash = hasher.hexdigest()
        if actual_hash != xpi_hash_value:
            log.warn("Incorrect hash %s, expected %s; aborting", actual_hash, xpi_hash_value)
            sys.exit(1)

        try:
            os.makedirs(args.output_directory, 0o755)
        except OSError as ex:
            if ex.errno != errno.EEXIST:
                raise

        dest_path = os.path.join(args.output_directory, listing['guid'] + ".xpi")
        shutil.move(temp_xpi, dest_path)
        os.chmod(dest_path, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP | stat.S_IROTH)
    finally:
        try:
            os.unlink(temp_xpi)
        except OSError as ex:
            if ex.errno != errno.ENOENT:
                raise

