#!/bin/sh
set -eu

echo "[entrypoint] BioPass Community starting..."

wait_for_db() {
  if [ -z "${DATABASE_URL:-}" ] && [ -z "${DB_HOST:-}" ]; then
    return 0
  fi

  echo "[entrypoint] Waiting for PostgreSQL..."
  i=0
  while [ "$i" -lt 60 ]; do
    if node --input-type=module -e "
      import pg from 'pg';
      const { Client } = pg;
      const url = process.env.DATABASE_URL || null;
      const cfg = url
        ? { connectionString: url, connectionTimeoutMillis: 3000 }
        : {
            host: process.env.DB_HOST || 'localhost',
            port: Number(process.env.DB_PORT || 5432),
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASS || '',
            database: process.env.DB_NAME || process.env.DB_SID || 'postgres',
            connectionTimeoutMillis: 3000,
          };
      const c = new Client(cfg);
      try {
        await c.connect();
        await c.query('SELECT 1');
        await c.end();
        process.exit(0);
      } catch {
        process.exit(1);
      }
    "; then
      echo "[entrypoint] Database is ready."
      return 0
    fi
    i=$((i + 1))
    sleep 2
  done

  echo "[entrypoint] Timed out waiting for database." >&2
  exit 1
}

wait_for_db

exec node index.js
