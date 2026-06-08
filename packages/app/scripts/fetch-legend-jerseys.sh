#!/usr/bin/env bash
# Fetch in-jersey photos for World Cup legends via Wikipedia article scraping.
# Uses Wikimedia Special:FilePath to download specific Commons files we identify
# by scoring filenames against jersey/year/team keywords.

set -u
cd "$(dirname "$0")/.."
DEST="public/players"
UA="Mozilla/5.0 gaffer-legends-fetcher"
TMP="/tmp/gaffer-legends"
mkdir -p "$TMP" "$DEST"

# Legend → (Wikipedia slug, keyword scoring regex)
# Score: higher is better — match year + team
LEGENDS=$(cat <<'EOF'
pele|Pel%C3%A9|1970|brasil|celebrating|World_Cup
maradona|Diego_Maradona|1986|Argentina|Mexico|Napoli
cruyff|Johan_Cruyff|1974|Ajax|Netherlands|Holland
zidane|Zinedine_Zidane|1998|France|Madrid|World_Cup
r9|Ronaldo_(Brazilian_footballer)|2002|Brazil|Inter|Madrid
ronaldinho|Ronaldinho|Brazil|Barcelona|2002
beckenbauer|Franz_Beckenbauer|1974|Germany|Bayern|World_Cup
george_best|George_Best|Manchester|United|1968|Northern
EOF
)

ok=0; fail=0

while IFS='|' read -r id slug k1 k2 k3 k4 k5 k6; do
  [ -z "$id" ] && continue
  echo "── ${id} ──"

  # Fetch article HTML
  html_file="${TMP}/${id}.html"
  curl -sS --max-time 15 -A "$UA" -o "$html_file" "https://en.wikipedia.org/api/rest_v1/page/html/${slug}"
  size=$(wc -c < "$html_file")
  if [ "$size" -lt 5000 ]; then
    echo "  ✗ article too small (${size}b)"
    fail=$((fail+1))
    continue
  fi

  # Extract File: refs
  files=$(grep -oE 'File:[A-Za-z0-9_%.()'\''-]+\.(jpg|JPG|jpeg|png)' "$html_file" | sort -u)

  # Score each filename — higher = better fit
  best=""; bestScore=-1
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    # Skip non-photo / icon files
    case "$f" in
      *Commons-logo*|*Lock-*|*Sports_icon*|*Firma*|*Wikisource*|*panoramio*|*signature*|*Signature*|*Graffiti*|*graffiti*) continue ;;
    esac
    score=0
    name_lower=$(echo "$f" | tr '[:upper:]' '[:lower:]')
    for kw in "${k1}" "${k2}" "${k3}" "${k4}" "${k5}" "${k6}"; do
      [ -z "$kw" ] && continue
      kw_lower=$(echo "$kw" | tr '[:upper:]' '[:lower:]')
      case "$name_lower" in
        *"${kw_lower}"*) score=$((score + 10)) ;;
      esac
    done
    # Bonus for cropped (better composition)
    case "$name_lower" in *cropped*) score=$((score + 5)) ;; esac
    # Bonus for celebrating / playing
    case "$name_lower" in *celebrat*|*playing*|*goal*|*match*) score=$((score + 8)) ;; esac
    if [ "$score" -gt "$bestScore" ]; then
      best="$f"; bestScore="$score"
    fi
  done <<< "$files"

  if [ -z "$best" ] || [ "$bestScore" -le 0 ]; then
    echo "  ✗ no jersey-relevant file found (best: '$best' score=$bestScore)"
    fail=$((fail+1))
    continue
  fi

  # Download via Special:FilePath at 600px width
  fn_only=${best#File:}
  url="https://commons.wikimedia.org/wiki/Special:FilePath/${fn_only}?width=600"
  echo "  → $best  (score=$bestScore)"

  if curl -fsS --max-time 20 -A "$UA" -L -o "${DEST}/${id}.png" "$url"; then
    actual_size=$(wc -c < "${DEST}/${id}.png")
    sig=$(head -c4 "${DEST}/${id}.png" | od -An -tx1 | tr -d ' ')
    if [ "$actual_size" -gt 10000 ]; then
      echo "  ✓ ${actual_size}b  sig=${sig}"
      # Convert JPEG to PNG if needed
      if [ "$sig" != "89504e47" ]; then
        FFMPEG="/c/Users/HP/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.1-full_build/bin/ffmpeg"
        mv "${DEST}/${id}.png" "${DEST}/${id}.tmp.jpg"
        "$FFMPEG" -y -i "${DEST}/${id}.tmp.jpg" "${DEST}/${id}.png" 2>/dev/null
        rm -f "${DEST}/${id}.tmp.jpg"
        echo "    ✓ converted to PNG"
      fi
      ok=$((ok+1))
    else
      echo "  ✗ too small (${actual_size}b)"
      rm -f "${DEST}/${id}.png"
      fail=$((fail+1))
    fi
  else
    echo "  ✗ download failed"
    fail=$((fail+1))
  fi
done <<< "$LEGENDS"

echo ""
echo "═══ ${ok} updated, ${fail} failed ═══"
