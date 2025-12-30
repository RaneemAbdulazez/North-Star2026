#!/bin/bash

# Define expected output directory
DIST_DIR="dist"

# Check if dist folder exists
if [ ! -d "$DIST_DIR" ]; then
  echo "❌ Error: '$DIST_DIR' directory not found after build."
  exit 1
fi

# Check if index.html exists in dist
if [ ! -f "$DIST_DIR/index.html" ]; then
  echo "❌ Error: 'index.html' not found in '$DIST_DIR'."
  exit 1
else
  echo "✅ Success: 'index.html' found in '$DIST_DIR'."
fi

# List contents of dist to verify structure
echo "📂 Contents of '$DIST_DIR':"
ls -F "$DIST_DIR"
