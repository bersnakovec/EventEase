#!/usr/bin/env bash
# Obremenitveni test EventEase z Apache JMeter (naloga 4).
#
# Uporaba (iz korena repozitorija, Git Bash / Linux):
#   load/run.sh                 # polni test: 10 → 50 → 100 uporabnikov, 3 × 4 min
#   SMOKE=1 load/run.sh         # kratek preizkus načrta (2/3/4 uporabniki, 3 × 20 s)
#   KEEP_ENV=1 load/run.sh      # okolja po testu ne ustavi
#
# Rezultati: load/rezultati/<čas>/ (rezultati.jtl, porocilo/index.html, docker-stats.csv, jmeter.log, app.log)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOAD="$ROOT/load"
JMETER_VERSION=5.6.3
JMETER_HOME="$LOAD/.jmeter/apache-jmeter-$JMETER_VERSION"
PROJECT=eventease-load
COMPOSE=(docker compose -p "$PROJECT" -f "$ROOT/compose.yaml" -f "$LOAD/compose.load.yaml")
PORT=8090

# --- 1) JMeter (prenos ob prvem zagonu, preverjanje SHA-512) ---
if [[ ! -d "$JMETER_HOME" ]]; then
  echo ">> Prenašam Apache JMeter $JMETER_VERSION ..."
  mkdir -p "$LOAD/.jmeter"
  base="https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-$JMETER_VERSION.zip"
  curl -fsSL -o "$LOAD/.jmeter/jmeter.zip" "$base"
  expected="$(curl -fsSL "$base.sha512" | awk '{print $1}')"
  actual="$(sha512sum "$LOAD/.jmeter/jmeter.zip" | awk '{print $1}')"
  [[ "$expected" == "$actual" ]] || { echo "Neveljavna kontrolna vsota JMeter!"; exit 1; }
  (cd "$LOAD/.jmeter" && unzip -q jmeter.zip && rm jmeter.zip)
fi
# Neposredno prek java -jar (jmeter.bat ne prenese poti s presledki/šumniki, npr. ".../Šola/3. Letnik/...").
JMETER=(java -Xms1g -Xmx1g -jar "$JMETER_HOME/bin/ApacheJMeter.jar")

# --- 2) Sveže testno okolje (prazna baza) ---
echo ">> Zaganjam testno okolje ($PROJECT, vrata $PORT) ..."
"${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
"${COMPOSE[@]}" up -d --build --wait
for _ in $(seq 1 30); do
  curl -fs "http://localhost:$PORT/" >/dev/null && break
  sleep 1
done

# --- 3) Parametri profila ---
if [[ "${SMOKE:-0}" == "1" ]]; then
  PROFILE=(-Jusers1=2 -Jusers2=3 -Jusers3=4 -Jramp=5 -Jstep_duration=20 -Jpolls=10)
  TAG=smoke
else
  PROFILE=(-Jusers1=10 -Jusers2=50 -Jusers3=100 -Jramp=60 -Jstep_duration=240 -Jpolls=100)
  TAG=polni
fi
OUT="$LOAD/rezultati/$(date +%Y%m%d-%H%M%S)-$TAG"
mkdir -p "$OUT"

# --- 4) Spremljanje virov vsebnikov (vsakih ~2 s) ---
(
  echo "cas,vsebnik,cpu_odstotek,pomnilnik,pomnilnik_odstotek,omrezje_io,disk_io"
  while true; do
    ts="$(date +%H:%M:%S)"
    docker stats --no-stream --format "{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}},{{.NetIO}},{{.BlockIO}}" \
      $("${COMPOSE[@]}" ps -q) 2>/dev/null | sed "s/^/$ts,/"
    sleep 2
  done
) > "$OUT/docker-stats.csv" &
STATS_PID=$!
trap 'kill $STATS_PID 2>/dev/null || true' EXIT

# --- 5) Izvedba testa (ne-GUI način) + HTML poročilo ---
echo ">> Izvajam JMeter ($TAG) → $OUT"
"${JMETER[@]}" -n -t "$LOAD/eventease-obremenitev.jmx" \
  -Jhost=localhost -Jport=$PORT "${PROFILE[@]}" \
  -Jjmeter.reportgenerator.apdex_satisfied_threshold=500 \
  -Jjmeter.reportgenerator.apdex_tolerated_threshold=1500 \
  -Jjmeter.reportgenerator.overall_granularity=10000 \
  -l "$OUT/rezultati.jtl" -j "$OUT/jmeter.log" -e -o "$OUT/porocilo"

kill $STATS_PID 2>/dev/null || true

# --- 6) Stanje baze in dnevnik aplikacije ---
"${COMPOSE[@]}" exec -T db psql -U admin -d eventeasedb -At -c \
  "SELECT 'ankete', count(*) FROM polls UNION ALL SELECT 'glasovi', count(*) FROM votes UNION ALL SELECT 'izbire', count(*) FROM vote_options" \
  > "$OUT/stanje-baze.txt" || true
"${COMPOSE[@]}" logs app > "$OUT/app.log" 2>&1 || true

# --- 7) Vrednotenje kriterijev ---
node "$LOAD/evaluate.mjs" "$OUT" | tee "$OUT/vrednotenje.txt"

if [[ "${KEEP_ENV:-0}" != "1" ]]; then
  "${COMPOSE[@]}" down -v >/dev/null
fi
echo ">> Končano. HTML poročilo: $OUT/porocilo/index.html"
