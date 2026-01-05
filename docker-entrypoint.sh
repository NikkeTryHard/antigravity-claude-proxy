#!/bin/bash

# Start the antigravity proxy in the background
echo "Starting Antigravity Claude Proxy..."
cd /proxy
nohup npx tsx src/index.ts --fallback > /tmp/proxy.log 2>&1 &
PROXY_PID=$!

# Wait for proxy to start
echo "Waiting for proxy to start (PID: $PROXY_PID)..."
for i in {1..30}; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo ""
        echo "========================================"
        echo "  Antigravity Proxy is running!"
        echo "  Claude Code is configured to use it."
        echo "========================================"
        echo ""
        echo "Run 'claude' to start Claude Code"
        echo "Run 'tail -f /tmp/proxy.log' to see proxy logs"
        echo ""
        break
    fi
    sleep 1
done

# Check if proxy is still not running
if ! curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "WARNING: Proxy may not have started correctly"
    echo "Check logs with: cat /tmp/proxy.log"
    cat /tmp/proxy.log
fi

# If a command was passed, run it; otherwise start bash
if [ $# -gt 0 ]; then
    exec "$@"
else
    exec /bin/bash
fi
