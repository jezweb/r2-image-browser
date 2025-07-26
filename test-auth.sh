#!/bin/bash

echo "Testing R2 Image Browser Authentication..."
echo ""

URL="https://r2-image-browser.webfonts.workers.dev/api/folders"

echo "1. Testing without authentication (should fail with 401):"
curl -s -o /dev/null -w "%{http_code}" "$URL"
echo ""

echo ""
echo "2. Testing with correct credentials (should succeed with 200):"
curl -s -o /dev/null -w "%{http_code}" -u "jezweb:iconbrowser" "$URL"
echo ""

echo ""
echo "3. Testing with incorrect credentials (should fail with 401):"
curl -s -o /dev/null -w "%{http_code}" -u "wrong:credentials" "$URL"
echo ""

echo ""
echo "Authentication test complete!"