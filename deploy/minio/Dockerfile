# MinIO no longer publishes container images, so build the same release from
# source (the supported route). Pinned to the version used in development.
FROM golang:1-alpine AS build
RUN apk add --no-cache git
ARG MINIO_VERSION=RELEASE.2025-09-07T16-13-09Z
RUN CGO_ENABLED=0 go install github.com/minio/minio@${MINIO_VERSION}

FROM alpine:3
# curl is used by the compose healthcheck.
RUN apk add --no-cache curl ca-certificates
COPY --from=build /go/bin/minio /usr/local/bin/minio
VOLUME /data
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
