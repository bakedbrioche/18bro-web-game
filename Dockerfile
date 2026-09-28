FROM nginx:stable-alpine

LABEL org.opencontainers.image.title="18Bro: Run for the Chips" \
      org.opencontainers.image.description="Static production image for the 18Bro community web game" \
      org.opencontainers.image.source="https://github.com/tarasenkofedor/18bro-web-game"

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/

RUN test -f /usr/share/nginx/html/index.html \
    && test -f /usr/share/nginx/html/app.mjs \
    && find /usr/share/nginx/html -type d -exec chmod 755 {} \; \
    && find /usr/share/nginx/html -type f -exec chmod 644 {} \;

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=4 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1