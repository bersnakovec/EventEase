<?php
# MantisBT – konfiguracija za upravljanje napak EventEase (naloga 6, ZK).
# Priklopljeno v vsebnik prek compose.yaml (./config → /var/www/html/config).

$g_hostname          = 'db';
$g_db_type           = 'mysqli';
$g_database_name     = 'bugtracker';
$g_db_username       = 'mantis';
$g_db_password       = 'mantis';
$g_default_timezone  = 'Europe/Ljubljana';
$g_path              = 'http://localhost:8989/';
require __DIR__ . '/salt_inc.php';   # $g_crypto_master_salt (ni v repozitoriju)

# Lokalna namestitev: brez e-pošte in brez samoregistracije.
$g_enable_email_notification = OFF;
$g_allow_signup              = OFF;
$g_default_language          = 'slovene';
$g_short_date_format         = 'd. m. Y';
$g_normal_date_format        = 'd. m. Y H:i';
$g_complete_date_format      = 'd. m. Y H:i T';

# Kritičnost: 4 nivoji. Številske vrednosti so Mantisove (MINOR=50, MAJOR=60, BLOCK=80),
# da pravila, ki temeljijo na resnosti, delujejo naprej; oznake so v custom_strings_inc.php.
$g_severity_enum_string   = '20:trivial,50:minor,60:major,80:block';
$g_default_bug_severity   = MINOR;
$g_severity_significant_threshold = MAJOR;   # visoka in kritična sta poudarjeni

# Rok za odpravo (due date) je viden vsem in ga nastavlja razvijalec.
$g_due_date_view_threshold   = REPORTER;
$g_due_date_update_threshold = DEVELOPER;

# Polja ob vpisu, prikazu in urejanju napake.
$g_bug_report_page_fields = array(
	'category_id', 'view_state', 'handler', 'priority', 'severity', 'reproducibility',
	'platform', 'os', 'os_build', 'product_version', 'target_version', 'due_date',
	'summary', 'description', 'steps_to_reproduce', 'additional_info', 'tags', 'attachments',
);
$g_bug_view_page_fields = array(
	'id', 'project', 'category_id', 'view_state', 'date_submitted', 'last_updated',
	'reporter', 'handler', 'priority', 'severity', 'reproducibility', 'status', 'resolution',
	'platform', 'os', 'os_build', 'product_version', 'target_version', 'fixed_in_version', 'due_date',
	'summary', 'description', 'steps_to_reproduce', 'additional_info', 'tags', 'attachments',
);
$g_bug_update_page_fields = $g_bug_view_page_fields;

# Stolpci na seznamu in v izvozu (CSV/Excel). custom_* so lastna polja (glej README).
$g_view_issues_page_columns = array(
	'selection', 'edit', 'priority', 'id', 'severity', 'status', 'custom_Tip napake',
	'category_id', 'handler_id', 'due_date', 'last_updated', 'summary',
);
$g_csv_columns = array(
	'id', 'summary', 'custom_Tip napake', 'severity', 'priority', 'status', 'resolution',
	'category_id', 'custom_Testni primer', 'version', 'target_version', 'fixed_in_version',
	'custom_Brskalnik', 'platform', 'os', 'os_build', 'reproducibility',
	'reporter_id', 'handler_id', 'date_submitted', 'due_date', 'last_updated',
	'description', 'steps_to_reproduce', 'custom_Pričakovani rezultat', 'custom_Dejanski rezultat',
	'additional_information', 'tags',
);
$g_excel_columns = $g_csv_columns;

# Seznam in izvoz privzeto prikažeta vse napake, tudi zaprte (privzeto Mantis skrije zaprte).
$g_hide_status_default = META_FILTER_NONE;
