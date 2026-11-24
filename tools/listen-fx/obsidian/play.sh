#!/bin/bash
# play.sh <name> <button> <seconds>: clicks a Play button of the throwaway note, waits, prints the connections.
S="$(cd "$(dirname "$0")" && pwd)"; cd ~/notesSeb
echo "$1: $(timeout 40 obsidian eval code="$(sed "s/\[N\]/[$2]/" $S/click.js)")"
python3 -c "import time; time.sleep($3)"
echo "$1 log: $(timeout 40 obsidian eval code="$(cat $S/read.js)" | sed 's/,"ctxs".*//')"
