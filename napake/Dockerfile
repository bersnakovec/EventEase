# MantisBT 2.29 (izvorna koda se priklopi iz ./mantisbt) na PHP 8.3 + Apache (mod_rewrite za REST API).
FROM php:8.3-apache
RUN docker-php-ext-install mysqli \
 && a2enmod rewrite \
 && echo "date.timezone=Europe/Ljubljana" > /usr/local/etc/php/conf.d/tz.ini
