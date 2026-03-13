#!/bin/sh
set -e

host="$1"
port="$2"
shift 2
cmd="$@"

echo "Waiting for MySQL at $host:$port..."
until mysqladmin ping -h "$host" -P "$port" --silent; do
  echo "MySQL not ready, retrying in 2s..."
  sleep 2
done

echo "MySQL is ready — starting app"
exec $cmd
