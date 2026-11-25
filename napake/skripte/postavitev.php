<?php
# Postavitev MantisBT za EventEase (naloga 6): uporabnik, projekt, kategorije, verzije, lastna polja, žeton API.
# Zagon (iz mape napake/):  docker compose exec mantis php /skripte/postavitev.php
# Idempotentno: obstoječe elemente preskoči. Žeton API izpiše samo ob prvem zagonu (shrani se v skripte/.token).

require_once '/var/www/html/core.php';
auth_attempt_script_login( 'administrator' );

function korak( $s ) { echo "• $s\n"; }

# Uporabnik: Lenart (tester in razvijalec). Geslo lokalne namestitve: lenart
$t_user = user_get_id_by_name( 'lenart' );
if( !$t_user ) {
	user_create( 'lenart', 'lenart', 'lenart@eventease.test', MANAGER, false, true, 'Lenart Beršnak' );
	$t_user = user_get_id_by_name( 'lenart' );
	korak( "uporabnik lenart (vodja) id=$t_user" );
}

# Projekt
$t_project = project_get_id_by_name( 'EventEase', false );
if( !$t_project ) {
	$t_project = project_create( 'EventEase',
		'Spletna aplikacija za usklajevanje terminov (React + Zig + PostgreSQL). Napake iz funkcionalnih testov TS-L1..TS-L3 (Lenart Beršnak).',
		10 /* v razvoju */ );
	korak( "projekt EventEase id=$t_project" );
}
project_add_user( $t_project, $t_user, MANAGER );

# Kategorije = komponente sistema
$t_obstojece = array_column( category_get_all_rows( $t_project ), 'name' );
foreach( array( 'Frontend', 'Backend (API)', 'E-pošta in .ics', 'Dokumentacija' ) as $t_cat ) {
	if( !in_array( $t_cat, $t_obstojece ) ) { category_add( $t_project, $t_cat ); korak( "kategorija $t_cat" ); }
}

# Verzije: testirana (izdana) in naslednja (cilj popravkov)
foreach( array(
	array( '1.0 (6bad6db)', VERSION_RELEASED, 'Različica, testirana v nalogi 3 (11. 11. 2026).', '2026-11-11' ),
	array( '1.1', VERSION_FUTURE, 'Naslednja izdaja – cilj popravkov napak iz funkcionalnih testov.', '2026-12-23' ),
) as $v ) {
	if( !version_get_id( $v[0], $t_project ) ) {
		version_add( $t_project, $v[0], $v[1], $v[2], strtotime( $v[3] ) );
		korak( "verzija {$v[0]}" );
	}
}

# Lastna polja
$t_polja = array(
	'Tip napake' => array( 'type' => CUSTOM_FIELD_TYPE_ENUM, 'possible_values' => 'Napaka|Pomanjkljivost|Nedoslednost',
		'require_report' => true, 'require_update' => true, 'filter_by' => true ),
	'Brskalnik' => array( 'type' => CUSTOM_FIELD_TYPE_STRING, 'default_value' => 'Chromium 141.0.7390.37 (Playwright 1.56.1)',
		'require_report' => true, 'filter_by' => true ),
	'Testni primer' => array( 'type' => CUSTOM_FIELD_TYPE_STRING, 'filter_by' => true ),
	'Pričakovani rezultat' => array( 'type' => CUSTOM_FIELD_TYPE_TEXTAREA ),
	'Dejanski rezultat' => array( 'type' => CUSTOM_FIELD_TYPE_TEXTAREA ),
);
foreach( $t_polja as $t_ime => $t_def ) {
	$t_id = custom_field_get_id_from_name( $t_ime );
	if( !$t_id ) {
		$t_id = custom_field_create( $t_ime );
		custom_field_update( $t_id, $t_def + array(
			'name' => $t_ime, 'access_level_r' => VIEWER, 'access_level_rw' => REPORTER,
			'display_report' => true, 'display_update' => true, 'display_resolved' => true, 'display_closed' => true,
		) );
		korak( "lastno polje $t_ime (id=$t_id)" );
	}
	custom_field_link( $t_id, $t_project );
}

# Žeton API za vpis napak prek REST (v imenu uporabnika lenart)
$t_token_file = '/skripte/.token';
if( !file_exists( $t_token_file ) ) {
	file_put_contents( $t_token_file, api_token_create( 'vpis-napak', $t_user ) );
	korak( 'žeton API shranjen v skripte/.token' );
}
echo "Projekt EventEase id=$t_project, uporabnik lenart id=$t_user\n";
