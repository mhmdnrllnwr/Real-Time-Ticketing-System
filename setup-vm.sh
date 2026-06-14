#!/bin/bash
# setup-vm.sh — Run on GCP VM instance to deploy Cinema Ticketing System
# Usage: bash setup-vm.sh

set -e

echo "=================================="
echo " Cinema Ticketing — VM Setup"
echo "=================================="

# 1. Install Docker if missing
if ! command -v docker &> /dev/null; then
  echo "[1/4] Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  # Re-login needed for group change, use sudo for now
  DOCKER_CMD="sudo docker"
else
  echo "[1/4] Docker found"
  DOCKER_CMD="docker"
fi

# 2. Install Docker Compose plugin if missing
if ! $DOCKER_CMD compose version &> /dev/null; then
  echo "[2/4] Installing Docker Compose plugin..."
  if command -v apt-get &> /dev/null; then
    sudo apt-get update -qq && sudo apt-get install -y -qq docker-compose-plugin
  elif command -v yum &> /dev/null; then
    sudo yum install -y docker-compose-plugin
  fi
else
  echo "[2/4] Docker Compose found"
fi

# 3. Build & start
echo "[3/4] Building and starting services..."
$DOCKER_CMD compose up -d --build

# 4. Show status
echo "[4/4] Checking status..."
sleep 3
$DOCKER_CMD compose ps

echo ""
echo "=================================="
echo " Done"
echo "=================================="
echo ""
echo " App:   http://VM_EXTERNAL_IP:3000"
echo " Admin: http://VM_EXTERNAL_IP:3000/admin"
echo ""
echo " Useful commands:"
echo "   docker compose logs -f      Tail logs"
echo "   docker compose restart      Restart services"
echo "   docker compose down         Stop everything"
