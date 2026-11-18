#!/bin/sh
# Records what is sent to the headphones (the sink's monitor) for N seconds.
timeout "$2" parec -d bluez_output.78_2B_64_13_F1_55.1.monitor --format=float32le --rate=48000 --channels=2 --raw > "$1" 2>/dev/null
ls -l "$1" | awk '{print $5}'
