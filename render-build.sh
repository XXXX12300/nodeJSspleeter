#!/bin/bash

# Install Python & dependencies
echo "Installing Python & Spleeter..."
apt-get update && apt-get install -y python3 python3-pip ffmpeg
pip3 install spleeter

echo "✅ Build complete!"
