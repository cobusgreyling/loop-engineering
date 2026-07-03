# Always-on forward-tracking service. Pure stdlib — no pip install needed.
FROM python:3.11-slim

WORKDIR /app
COPY . /app

# Persist the track record to a mounted Volume here (Railway: mount at /data).
ENV QUANT_DATA_DIR=/data \
    CHECK_INTERVAL_SECONDS=86400 \
    AUTO_REGISTER=1
RUN mkdir -p /data

# Railway injects $PORT; the service binds 0.0.0.0:$PORT (default 8080).
EXPOSE 8080
CMD ["python", "-m", "engine.service"]
