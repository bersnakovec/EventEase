#!/bin/sh
# Izvoz vseh napak projekta EventEase iz MantisBT v CSV in Excel (naloga 6).
# Zagon (iz mape napake/):  sh skripte/izvoz.sh   → izvoz/napake_eventease.csv, izvoz/napake_eventease.xml
# Uporabi Mantisov vgrajeni izvoz (csv_export.php, excel_xml_export.php) z vsemi stanji, razvrščeno po ID.
set -e
URL=${MANTIS_URL:-http://localhost:8989}
USER=${MANTIS_USER:-lenart}
PASS=${MANTIS_PASS:-lenart}
J=$(mktemp)
trap 'rm -f "$J"' EXIT
token() { grep -oE 'name="login_token" value="[^"]*"' | sed 's/.*value="//;s/"//'; }

t1=$(curl -s -c "$J" -b "$J" "$URL/login_page.php" | token)
t2=$(curl -s -c "$J" -b "$J" -X POST "$URL/login_password_page.php" \
  --form-string login_token="$t1" --form-string username="$USER" --form-string return=index.php | token)
curl -s -c "$J" -b "$J" -X POST "$URL/login.php" --form-string login_token="$t2" \
  --form-string username="$USER" --form-string password="$PASS" --form-string return=index.php -o /dev/null

# Filter: projekt EventEase, vsa stanja (tudi zaprta), razvrščeno po ID naraščajoče.
curl -s -c "$J" -b "$J" "$URL/set_project.php?project_id=1" -o /dev/null
curl -s -c "$J" -b "$J" "$URL/view_all_set.php?type=1&hide_status=-2&sort=id&dir=ASC" -o /dev/null

mkdir -p izvoz
curl -s -b "$J" "$URL/csv_export.php" -o izvoz/napake_eventease.csv
curl -s -b "$J" "$URL/excel_xml_export.php" -o izvoz/napake_eventease.xml
echo "CSV: $(($(grep -c '^0000' izvoz/napake_eventease.csv))) napak, Excel: $(grep -c '<Row' izvoz/napake_eventease.xml) vrstic (z glavo)"
node skripte/izvoz-json.mjs
