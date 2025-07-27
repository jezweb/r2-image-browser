#!/bin/bash

echo "Setting up Wrangler secrets for R2 Image Browser..."
echo ""
echo "This script will set up the following secrets:"
echo "- BASIC_USER (username for basic auth)"
echo "- BASIC_PASS (password for basic auth)"
echo ""
echo "Current values:"
echo "- BASIC_USER: jezweb"
echo "- BASIC_PASS: Footwork-Ahoy-Unbundle8"
echo ""
echo "Press Enter to use these values or Ctrl+C to cancel..."
read

# Set the secrets
echo "jezweb" | wrangler secret put BASIC_USER
echo "Footwork-Ahoy-Unbundle8" | wrangler secret put BASIC_PASS

echo ""
echo "Secrets have been configured!"
echo "The app should now require authentication at: https://r2-image-browser.webfonts.workers.dev"