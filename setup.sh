#!/bin/bash

# ==============================================================================
# Choco Choo Production Setup Script for AWS EC2 Ubuntu Server
# ==============================================================================
# This script automates installing Node.js, PM2 (process manager), Nginx (reverse
# proxy), configuring the firewall, building the app, and running it in production.
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

echo "=================================================="
echo "🚀 Starting Choco Choo Installation on Ubuntu..."
echo "=================================================="

# 1. Update package indices
echo "🔄 Updating system package lists..."
sudo apt-get update -y
sudo apt-get upgrade -y

# 2. Install prerequisites
echo "🛠️ Installing essential tools (curl, git, build-essential)..."
sudo apt-get install -y curl git build-essential

# 3. Install Node.js (NodeSource PPA for Node.js 20 LTS)
echo "📦 Fetching Node.js 20 LTS installation source..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
echo "📥 Installing Node.js and NPM..."
sudo apt-get install -y nodejs

# Verify versions
echo "🔍 Installed versions:"
echo "Node.js: $(node -v)"
echo "NPM: $(npm -v)"

# 4. Install PM2 globally (Process Manager to run the app persistently)
echo "⚙️ Installing Process Manager (PM2) globally..."
sudo npm install -g pm2

# 5. Install Nginx (Reverse Proxy)
echo "🌐 Installing Nginx Server..."
sudo apt-get install -y nginx

# 6. Configure Nginx Reverse Proxy (Port 80 -> Next.js Port 3000)
echo "✍️ Writing Nginx server block configuration..."
sudo tee /etc/nginx/sites-available/chocochoo << 'EOF'
server {
    listen 80;
    server_name _; # Responds to any IP address or domain configured in EC2

    # Enable gzip compression for fast assets transfer
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

echo "🔗 Enabling Nginx server block configuration..."
# Enable the block and remove default Nginx welcome page
sudo ln -sf /etc/nginx/sites-available/chocochoo /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

echo "✅ Testing Nginx configuration..."
sudo nginx -t

echo "🔄 Restarting Nginx service..."
sudo systemctl restart nginx
sudo systemctl enable nginx

# 7. Configure Firewall (UFW)
echo "🔒 Configuring system firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
# Enable firewall (non-interactively)
echo "y" | sudo ufw enable
sudo ufw status

# 8. Setup Application in current working directory
echo "📦 Installing project local packages..."
npm install

# 9. Build the Next.js Production Bundle
echo "🏗️ Building the Next.js production bundle..."
npm run build

# 10. Start the Application via PM2
echo "🏃 Starting Choco Choo using PM2..."
# Kill existing instance if any
pm2 delete choco-choo 2>/dev/null || true
# Start Next.js server on port 3000
pm2 start npm --name "choco-choo" -- start

# Configure PM2 to start automatically on system reboot
echo "🔄 Setting up PM2 boot startup config..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
pm2 save

echo "=================================================="
echo "🎉 Choco Choo Installation Completed successfully!"
echo "=================================================="
echo "👉 You can now access your website on your EC2 public IP:"
echo "   http://<YOUR_EC2_PUBLIC_IP>"
echo ""
echo "ℹ️  Admin details:"
echo "   - URL: http://<YOUR_EC2_PUBLIC_IP>/admin"
echo "   - Account details can be modified in .env file."
echo "=================================================="
