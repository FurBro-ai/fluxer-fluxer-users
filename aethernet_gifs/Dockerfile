# SPDX-License-Identifier: AGPL-3.0-or-later

FROM rust:1-bookworm AS builder

WORKDIR /usr/src/app

COPY . .

RUN cargo build --release -p aethernet-gifs

FROM debian:bookworm-slim

ARG BUILD_VERSION=""
ARG SOURCE_SHA=""
ARG SOURCE_DATE=""

LABEL org.opencontainers.image.title="aethernet-gifs"
LABEL org.opencontainers.image.description="Aethernet GIF search and proxy service"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
LABEL org.opencontainers.image.vendor="Aethernet"
LABEL org.opencontainers.image.url="https://aethernet.app"
LABEL org.opencontainers.image.documentation="https://docs.aethernet.app"
LABEL org.opencontainers.image.source="https://github.com/aethernetapp/aethernet"
LABEL org.opencontainers.image.version="${BUILD_VERSION}"
LABEL org.opencontainers.image.revision="${SOURCE_SHA}"
LABEL org.opencontainers.image.created="${SOURCE_DATE}"
LABEL app.aethernet.build-version="${BUILD_VERSION}"

WORKDIR /usr/local/bin

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
	rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app/target/release/aethernet-gifs /usr/local/bin/aethernet-gifs

ENV BUILD_VERSION="${BUILD_VERSION}"

USER 65532:65532

EXPOSE 8090

CMD ["/usr/local/bin/aethernet-gifs"]
