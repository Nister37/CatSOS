FROM node:26-alpine AS deps

WORKDIR /app
RUN npm install --global yarn@1.22.22

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM deps AS development
COPY . .
RUN adduser -D appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 5173
CMD ["yarn", "dev:docker"]

FROM development AS test
USER appuser
CMD ["sh", "-c", "yarn lint && yarn test:ci && yarn tsc --noEmit"]

FROM cypress/included:15.18.0 AS cypress
WORKDIR /app
RUN yarn --version | grep -q '^1\.' || npm install --global --force yarn@1.22.22
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
ENTRYPOINT []
CMD ["yarn", "e2e"]

FROM development AS builder
USER root
RUN yarn build

FROM nginx:1.27-alpine AS runtime
RUN adduser -D appuser
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
RUN chown -R appuser:appuser /usr/share/nginx/html
USER appuser
EXPOSE 80
