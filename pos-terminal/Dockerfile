FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# The nginx entrypoint expands ${PORT} and ${BACKEND_URL} in the template.
ENV PORT=80
ENV BACKEND_URL=backend.railway.internal:3000
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
