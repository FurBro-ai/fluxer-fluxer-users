# syntax=docker/dockerfile:1.7
# SPDX-License-Identifier: AGPL-3.0-or-later

FROM caddy:2.10-alpine

ARG BUILD_VERSION=""
ARG SOURCE_SHA=""
ARG SOURCE_DATE=""

LABEL org.opencontainers.image.title="aethernet-static"
LABEL org.opencontainers.image.description="Self-hostable static asset bundle for AETHERNET"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
LABEL org.opencontainers.image.vendor="AETHERNET"
LABEL org.opencontainers.image.url="https://aethernet.app"
LABEL org.opencontainers.image.documentation="https://docs.aethernet.app"
LABEL org.opencontainers.image.source="https://github.com/aethernetapp/aethernet"
LABEL org.opencontainers.image.version="${BUILD_VERSION}"
LABEL org.opencontainers.image.revision="${SOURCE_SHA}"
LABEL org.opencontainers.image.created="${SOURCE_DATE}"
LABEL app.aethernet.build-version="${BUILD_VERSION}"

COPY aethernet_static/Caddyfile /etc/caddy/Caddyfile
COPY --chown=65532:65532 aethernet_static/avatars /srv/aethernet-static/avatars
COPY --chown=65532:65532 aethernet_static/badges /srv/aethernet-static/badges
COPY --chown=65532:65532 aethernet_static/desktop /srv/aethernet-static/desktop
COPY --chown=65532:65532 aethernet_static/embeds /srv/aethernet-static/embeds
COPY --chown=65532:65532 aethernet_static/emoji /srv/aethernet-static/emoji
COPY --chown=65532:65532 aethernet_static/libs /srv/aethernet-static/libs
COPY --chown=65532:65532 aethernet_static/web /srv/aethernet-static/web

RUN setcap -r /usr/bin/caddy \
	&& mkdir -p /config/caddy /data/caddy \
	&& chown -R 65532:65532 /config /data /srv/aethernet-static

USER 65532:65532

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
	CMD wget -q -O - http://127.0.0.1:8080/_health | grep -q OK
