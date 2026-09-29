#!/bin/sh
# The landing ships one static page whose "Панель управления" / "Открыть кассу"
# links depend on where those apps live. Rather than baking a domain into the
# image, the links are substituted when the container starts, from
# ADMIN_URL / POS_URL / CONTACT_EMAIL.
set -e

: "${ADMIN_URL:=#}"
: "${POS_URL:=#}"
: "${CONTACT_EMAIL:=hello@qwik.uz}"
export ADMIN_URL POS_URL CONTACT_EMAIL

template=/usr/share/nginx/template/index.html
target=/usr/share/nginx/html/index.html

if [ -f "$template" ]; then
  envsubst '${ADMIN_URL} ${POS_URL} ${CONTACT_EMAIL}' < "$template" > "$target"
  echo "landing: links set to ADMIN_URL=$ADMIN_URL POS_URL=$POS_URL"
fi
