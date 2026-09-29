FROM nginx:alpine

# index.html is kept as a template: the entrypoint writes the served copy with
# the real links at start-up (see entrypoint-links.sh).
COPY index.html /usr/share/nginx/template/index.html
COPY favicon.svg robots.txt /usr/share/nginx/html/
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY entrypoint-links.sh /docker-entrypoint.d/30-landing-links.sh
RUN chmod +x /docker-entrypoint.d/30-landing-links.sh

ENV PORT=80
ENV ADMIN_URL=#
ENV POS_URL=#
ENV CONTACT_EMAIL=hello@qwik.uz

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
