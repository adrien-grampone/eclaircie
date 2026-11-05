#!/bin/zsh
# Compile et lance le banc de capture, puis assemble la planche design/captures/widget-<date>.png.
set -e
cd "$(dirname "$0")/../.."
OUT=design/widget/out; BIN=design/widget/.snapshot
mkdir -p "$OUT"
swiftc -O -framework SwiftUI -framework AppKit -framework CoreText app/targets/widget/WidgetModel.swift app/targets/widget/WidgetViews.swift design/widget/main.swift -o "$BIN"
"$BIN" "$PWD/app/targets/widget/assets" "$PWD/$OUT"
