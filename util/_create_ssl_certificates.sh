#!/bin/sh

set -e

# Create SSL certificates for local development using mkcert.
# Optimized for macOS. On other platforms, we simply check mkcert and guide the user.

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
SSL_DIR="$SCRIPT_DIR/traefik/ssl"

mkdir -p "$SSL_DIR"
cd "$SSL_DIR" || exit 1

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert is not installed."
  if [ "$(uname -s 2>/dev/null)" = "Darwin" ]; then
    echo "Install mkcert on macOS with Homebrew (recommended):"
    echo "  brew install mkcert nss"
  else
    echo "Please install mkcert: https://github.com/FiloSottile/mkcert"
  fi
  exit 1
fi

# Ensure local CA is installed (idempotent)
mkcert -install >/dev/null 2>&1 || true

CAROOT="$(mkcert -CAROOT)"
if [ -f "$CAROOT/rootCA.pem" ]; then
  cp "$CAROOT/rootCA.pem" "$SSL_DIR/rootCA.pem"
  chmod 0644 "$SSL_DIR/rootCA.pem"
fi

# If a certificate for klicker.com already exists, skip.
if ls klicker.com*.pem >/dev/null 2>&1; then
  echo "SSL certificates already exist in $SSL_DIR. Skipping creation."
  exit 0
fi

echo "Creating SSL certificates for klicker.com and *.klicker.com in $SSL_DIR ..."
mkcert klicker.com "*.klicker.com"
echo "SSL certificates created."
#!/bin/sh
