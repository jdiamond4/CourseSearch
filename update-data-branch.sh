#!/bin/bash

# Script to update the data branch with new data files
# Usage: ./update-data-branch.sh

echo "🔄 Updating data branch with new data files..."

# Switch to data branch
git checkout data

# Copy data files from main branch
git checkout main -- data/

# Add and commit changes
git add data/
git commit -m "Update data files - $(date '+%Y-%m-%d %H:%M:%S')"

# Push to remote
git push origin data

echo "✅ Data branch updated successfully!"

# Switch back to main branch
git checkout main

echo "🏠 Back on main branch"