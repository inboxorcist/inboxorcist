#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}${GREEN}Installing Inboxorcist...${NC}"
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

# Detect shell config file
detect_shell_config() {
  if [ -n "$ZSH_VERSION" ] || [ "$SHELL" = "/bin/zsh" ] || [ "$SHELL" = "/usr/bin/zsh" ]; then
    echo "$HOME/.zshrc"
  elif [ -n "$BASH_VERSION" ] || [ "$SHELL" = "/bin/bash" ] || [ "$SHELL" = "/usr/bin/bash" ]; then
    if [ -f "$HOME/.bashrc" ]; then
      echo "$HOME/.bashrc"
    else
      echo "$HOME/.bash_profile"
    fi
  elif [ -f "$HOME/.profile" ]; then
    echo "$HOME/.profile"
  else
    echo "$HOME/.bashrc"
  fi
}

SHELL_CONFIG=$(detect_shell_config)
SHELL_NAME=$(basename "$SHELL_CONFIG")

# Check if already in PATH
if echo "$PATH" | grep -q "$INSTALL_DIR"; then
  echo -e "${GREEN}Inboxorcist is already in your PATH.${NC}"
  PATH_ADDED=true
else
  # Ask user if they want to add to PATH
  echo -e "${YELLOW}Would you like to add Inboxorcist to your PATH?${NC}"
  echo -e "This will let you run 'inboxorcist' from anywhere."
  echo ""
  read -p "Add to PATH? (Y/n): " ADD_TO_PATH < /dev/tty

  if [ "$ADD_TO_PATH" != "n" ] && [ "$ADD_TO_PATH" != "N" ]; then
    # Add to shell config
    echo "" >> "$SHELL_CONFIG"
    echo "# Inboxorcist" >> "$SHELL_CONFIG"
    echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$SHELL_CONFIG"

    echo ""
    echo -e "${GREEN}Added to $SHELL_NAME${NC}"
    echo -e "Run ${CYAN}source $SHELL_CONFIG${NC} or restart your terminal to use 'inboxorcist' command."
    PATH_ADDED=true

    # Source the config in the current shell
    export PATH="$INSTALL_DIR:$PATH"
  else
    echo ""
    echo -e "To add to PATH later, run:"
    echo -e "  ${CYAN}echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> $SHELL_CONFIG${NC}"
    PATH_ADDED=false
  fi
fi

echo ""
echo -e "For more info: ${CYAN}https://github.com/$REPO${NC}"
echo ""

# Ask if user wants to start now
echo -e "${YELLOW}Would you like to start Inboxorcist now?${NC}"
read -p "Start now? (Y/n): " START_NOW < /dev/tty

if [ "$START_NOW" != "n" ] && [ "$START_NOW" != "N" ]; then
  echo ""
  echo -e "${GREEN}Starting Inboxorcist...${NC}"
  echo ""
  exec "$INSTALL_DIR/$BINARY_NAME"
else
  echo ""
  echo -e "To start Inboxorcist later, run:"
  if [ "$PATH_ADDED" = true ]; then
    echo -e "  ${CYAN}inboxorcist${NC}"
  else
    echo -e "  ${CYAN}$INSTALL_DIR/inboxorcist${NC}"
  fi
  echo ""
fi
