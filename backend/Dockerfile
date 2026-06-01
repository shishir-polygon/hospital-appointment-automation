FROM php:8.4-fpm-alpine

RUN apk add --no-cache \
    postgresql-dev \
    redis \
    libzip-dev \
    oniguruma-dev \
    $PHPIZE_DEPS \
    && docker-php-ext-install pdo pdo_pgsql zip mbstring pcntl \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del $PHPIZE_DEPS

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY composer.json composer.lock* ./
RUN composer install --no-dev --no-scripts --no-interaction --prefer-dist

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "php artisan config:clear && php artisan route:cache && php artisan serve --host=0.0.0.0 --port=8000"]
