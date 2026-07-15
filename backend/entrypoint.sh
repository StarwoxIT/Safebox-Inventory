#!/bin/sh
chown -R app:app /data
exec su-exec app node src/server.js
