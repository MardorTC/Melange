#!/bin/sh
set -eu
# Called through run.sh, so installation and tests use the same browser directory.
npm ci
./node_modules/.bin/playwright install chromium
node scripts/doctor.mjs
