FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# Должен отработать до 20-envsubst-on-templates.sh — отсюда номер 16.
COPY resolver-fallback.envsh /docker-entrypoint.d/16-resolver-fallback.envsh
# Энтрипоинт сорсит только исполняемые файлы; бит из git может не доехать.
RUN chmod +x /docker-entrypoint.d/16-resolver-fallback.envsh
# The nginx entrypoint expands ${PORT} and ${BACKEND_URL} in the template.
ENV PORT=80
ENV BACKEND_URL=backend.railway.internal:3000
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
