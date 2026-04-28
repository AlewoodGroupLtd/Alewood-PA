#!/bin/bash
# Moltbot & Antigravity Server Setup Script (Runs as root on GCP startup)

echo "Starting setup for Moltbot and Antigravity..."

# Install dependencies
apt-get update && apt-get install -y \
    curl \
    git \
    nodejs \
    npm \
    python3-pip \
    python3-venv \
    build-essential \
    screen

# Create workspace
mkdir -p /opt/alewood/workspace
mkdir -p /opt/alewood/moltbot
chown -R $USER:$USER /opt/alewood

# Install Moltbot (mock installation for structural purposes)
echo "Installing Moltbot Orchestrator..."
cd /opt/alewood/moltbot
# npm install -g moltbot-cli notebooklm-mcp-cli

# Set up systemd service for Moltbot
cat <<EOF > /etc/systemd/system/moltbot.service
[Unit]
Description=Moltbot Orchestrator for Antigravity
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/alewood/moltbot
ExecStart=/usr/bin/node /opt/alewood/moltbot/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# Reload daemon and start Moltbot
systemctl daemon-reload
systemctl enable moltbot
systemctl start moltbot

echo "Moltbot installed and started."
