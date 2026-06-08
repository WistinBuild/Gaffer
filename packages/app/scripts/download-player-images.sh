#!/usr/bin/env bash
# Downloads all player face images from SoFIFA CDN to /public/players/{id}.png
# Run once: bash scripts/download-player-images.sh

set -u
cd "$(dirname "$0")/.."
DEST="public/players"
mkdir -p "$DEST"

# id|sofifa_path (split as first3/last3 of the 6-digit SoFIFA player id)
PLAYERS=$(cat <<'EOF'
mbappe|231/747
vinicius|238/794
haaland|239/085
salah|209/331
son|200/104
kane|202/126
lautaro|231/516
rodrygo|247/635
griezmann|194/765
nkunku|236/401
alvarez|253/512
osimhen|231/677
bellingham|252/371
rodri|231/866
modric|177/003
casemiro|200/145
de_bruyne|192/985
foden|237/692
saka|246/669
declan_rice|239/091
bruno_guimaraes|240/606
musiala|256/790
pedri|251/854
gavi|258/856
valverde|237/057
vitinha|244/394
tchouameni|249/731
paqueta|221/097
bruno_fernandes|212/198
van_dijk|203/376
marquinhos|207/865
militao|236/795
ruben_dias|239/818
rudiger|205/452
kounde|239/729
hakimi|235/212
walker|188/377
reece_james|238/479
theo_hernandez|232/656
cancelo|210/514
carvajal|204/963
balde|261/175
lisandro|237/498
mazraoui|239/078
alisson|212/831
ederson|210/257
maignan|232/411
courtois|192/119
neuer|167/495
pickford|213/331
unai_simon|231/681
diogo_costa|247/698
EOF
)

ok=0
fail=0
exists=0

# Try multiple FC versions in case 25 isn't published for a player
VERSIONS="25 24 23"

while IFS='|' read -r id path; do
  [ -z "$id" ] && continue
  out="$DEST/${id}.png"

  if [ -f "$out" ] && [ -s "$out" ]; then
    exists=$((exists+1))
    continue
  fi

  got=""
  for v in $VERSIONS; do
    url="https://cdn.sofifa.net/players/${path}/${v}_120.png"
    if curl -fsS --max-time 10 -o "$out" "$url" 2>/dev/null; then
      got="$v"
      break
    fi
  done

  if [ -n "$got" ] && [ -s "$out" ]; then
    ok=$((ok+1))
    echo "  ✓ $id (FC$got)"
  else
    fail=$((fail+1))
    rm -f "$out"
    echo "  ✗ $id"
  fi
done <<< "$PLAYERS"

echo ""
echo "Done: $ok downloaded, $exists already cached, $fail failed"
