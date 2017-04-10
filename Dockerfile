FROM alpine:3.4

RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY quicknotes_linux /app/quicknotes
COPY quicknotes_resources.zip /app/quicknotes_resources.zip

EXPOSE 80 443

CMD ["/app/quicknotes", "-production"]
