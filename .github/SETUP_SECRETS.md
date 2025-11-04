# GitHub Secrets Setup Guide

This guide explains how to add your MongoDB connection string as a GitHub secret so the automated workflow can access your database.

## Adding the MONGODB_URI Secret

1. **Go to your GitHub repository**
   - Navigate to: `https://github.com/YOUR_USERNAME/YOUR_REPO_NAME`

2. **Access Settings**
   - Click on the "Settings" tab at the top of the repository page

3. **Navigate to Secrets**
   - In the left sidebar, expand "Secrets and variables"
   - Click on "Actions"

4. **Add New Secret**
   - Click the green "New repository secret" button

5. **Enter Secret Details**
   - **Name:** `MONGODB_URI`
   - **Value:** Your MongoDB connection string (e.g., `mongodb+srv://username:password@cluster.mongodb.net/hooslist`)
   - Click "Add secret"

## Verifying the Secret is Set Up

After adding the secret, you can verify it's working by:

1. Go to the "Actions" tab in your repository
2. Click on "Update MongoDB Course Data" workflow
3. Click "Run workflow" button (this manually triggers it)
4. Select the branch (usually `main`)
5. Click "Run workflow"

The workflow will run and you can see the logs to verify it's connecting to MongoDB successfully.

## Current Workflow Configuration

The workflow is set to:
- **Schedule:** Run every hour at the top of the hour (`:00`)
- **Command:** `node scripts/sisToMongo.js --term=1262 --all --replace`
- **Updates:** All departments for Spring 2026 (term 1262)

## Updating the Term Code

When you need to update for a new semester:

1. Edit `.github/workflows/update-mongodb.yml`
2. Find the line: `run: node scripts/sisToMongo.js --term=1262 --all --replace`
3. Change `1262` to the new term code:
   - Spring 2026: 1262 (current)
   - Fall 2026: 1268
   - Spring 2027: 1272
   - etc.
4. Commit and push the changes

## Manual Trigger

You can manually trigger the workflow anytime from the Actions tab without waiting for the hourly schedule.

## Troubleshooting

If the workflow fails:
1. Check the Actions tab for error logs
2. Verify your MONGODB_URI secret is correct
3. Ensure your MongoDB cluster allows connections from GitHub's IP addresses (or allow all IPs: `0.0.0.0/0`)
4. Check that your MongoDB user has write permissions to the database

## Security Notes

- Never commit your MongoDB connection string to the repository
- GitHub secrets are encrypted and only exposed to Actions during runtime
- You can update or delete secrets anytime from the Settings > Secrets page

