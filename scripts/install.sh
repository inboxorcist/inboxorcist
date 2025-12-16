#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${GREEN}Installing Inboxorcist...${NC}"
echo ""

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$OS" in
  linux)
    OS="linux"
    ;;
  darwin)
    OS="darwin"
    ;;
  mingw*|msys*|cygwin*)
    OS="windows"
    ;;
  *)
    echo -e "${RED}Unsupported operating system: $OS${NC}"
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64|amd64)
    ARCH="x64"
    ;;
  arm64|aarch64)
    ARCH="arm64"
    ;;
  *)
    echo -e "${RED}Unsupported architecture: $ARCH${NC}"
    exit 1
    ;;
esac

# Determine install directory
if [ "$OS" = "windows" ]; then
  INSTALL_DIR="$HOME/inboxorcist"
  BINARY_NAME="inboxorcist.exe"
  ARCHIVE_EXT="zip"
else
  INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/share/inboxorcist}"
  BINARY_NAME="inboxorcist"
  ARCHIVE_EXT="tar.gz"
fi

echo -e "  OS:           ${CYAN}$OS${NC}"
echo -e "  Architecture: ${CYAN}$ARCH${NC}"
echo -e "  Install to:   ${CYAN}$INSTALL_DIR${NC}"
echo ""

# Get latest release version from GitHub
REPO="inboxorcist/inboxorcist"
echo -e "${YELLOW}Fetching latest release...${NC}"

LATEST_VERSION=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_VERSION" ]; then
  echo -e "${RED}Failed to fetch latest version${NC}"
  exit 1
fi

echo -e "  Version: ${CYAN}$LATEST_VERSION${NC}"
echo ""

# Construct download URL
FILENAME="inboxorcist-${OS}-${ARCH}.${ARCHIVE_EXT}"
DOWNLOAD_URL="https://github.com/$REPO/releases/download/$LATEST_VERSION/$FILENAME"

echo -e "${YELLOW}Downloading $FILENAME...${NC}"

# Create temp directory
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

# Download
if ! curl -fsSL "$DOWNLOAD_URL" -o "$TMP_DIR/$FILENAME"; then
  echo -e "${RED}Failed to download from $DOWNLOAD_URL${NC}"
  echo -e "${YELLOW}Make sure the release exists and includes binaries for your platform.${NC}"
  exit 1
fi

# Extract
echo -e "${YELLOW}Extracting...${NC}"
mkdir -p "$INSTALL_DIR"

if [ "$ARCHIVE_EXT" = "zip" ]; then
  unzip -q "$TMP_DIR/$FILENAME" -d "$INSTALL_DIR"
else
  tar -xzf "$TMP_DIR/$FILENAME" -C "$INSTALL_DIR" --strip-components=1
fi

# Make executable
chmod +x "$INSTALL_DIR/$BINARY_NAME"

echo ""
echo -e "${GREEN}Installation complete!${NC}"
echo ""
echo -e "To start Inboxorcist:"
echo -e "  ${CYAN}$INSTALL_DIR/inboxorcist${NC}"
echo ""
echo -e "To run from anywhere, add to your PATH:"
echo -e "  ${CYAN}echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.zshrc${NC}"
echo -e "  ${CYAN}source ~/.zshrc${NC}"
echo -e "  ${CYAN}inboxorcist${NC}"
echo ""
echo -e "For more info: ${CYAN}https://github.com/$REPO${NC}"
echo ""
