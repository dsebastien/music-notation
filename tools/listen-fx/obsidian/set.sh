#!/bin/bash
# set.sh <level> <length> <cabinet true|false> <drive>: writes the four settings through the plugin.
cd ~/notesSeb
timeout 60 obsidian eval code="(async () => { const p = app.plugins.plugins['music-practice']; await p.updateSettings(d => { d.playback.roomLevel = $1; d.playback.roomLength = $2; d.playback.ampCabinet = $3; d.playback.ampDrive = $4 }); const b = p.settings.playback; return [b.roomLevel, b.roomLength, b.ampCabinet, b.ampDrive].join(' ') })()"
