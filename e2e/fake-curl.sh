#!/bin/sh
# Testni dvojnik (test double) za `curl` v testnem okolju naloge 3.
# Backend pošilja e-pošto z `curl ... https://api.resend.com/emails -d <json>`.
# Ta skripta se v vsebniku namesti v /usr/local/bin (pred /usr/bin v PATH),
# vsebino zahteve zapiše v /tmp/outbox/*.json in vrne HTTP 200 – nobena zahteva
# ne zapusti vsebnika. Testi iz odložišča preberejo prejemnike, zadevo in priponko .ics.
out=/tmp/outbox
mkdir -p "$out"
data=""
ofile=""
while [ $# -gt 0 ]; do
  case "$1" in
    -d|--data) shift; data="$1" ;;
    -o) shift; ofile="$1" ;;
    -w|-X|-H) shift ;;
  esac
  shift
done
f="$out/$(date +%s)-$$.json"
case "$data" in
  @*) cat "${data#@}" > "$f" ;;
  *) printf '%s' "$data" > "$f" ;;
esac
[ -n "$ofile" ] && printf '{"id":"e2e-outbox"}' > "$ofile"
printf '200'
