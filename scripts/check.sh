#!/usr/bin/env bash
# Static checks: py_compile on every .py, syntax check on every .js
set -e
cd "$(dirname "$0")/.."
echo "== py_compile =="
find . -name "*.py" -not -path "./.venv/*" -print0 | xargs -0 -n1 python3 -m py_compile && echo "all .py files compile"
echo "== JS syntax =="
for f in $(find nexovia/static/js -name "*.js"); do node --check "$f" && echo "ok $f"; done
