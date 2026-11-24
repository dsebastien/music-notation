#!/bin/bash
# take.sh <name> <button> <seconds>: records the default sink's monitor while a Play button of the throwaway note is clicked.
S="$(cd "$(dirname "$0")" && pwd)"; cd ~/notesSeb
MON="$(pactl get-default-sink).monitor"
timeout "$3" parec -d "$MON" --format=float32le --rate=48000 --channels=2 --raw > "$S/$1.f32" 2>/dev/null &
REC=$!
python3 -c "import time; time.sleep(1.0)"
echo "$1: $(timeout 20 obsidian eval code="$(sed "s/\[N\]/[$2]/" $S/click.js)")"
wait $REC
echo "$1 log: $(timeout 20 obsidian eval code="$(cat $S/read.js)")"
ls -l "$S/$1.f32" | awk '{print $5}'
