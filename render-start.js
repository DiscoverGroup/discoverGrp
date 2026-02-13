#!/usr/bin/env node

/**
 * Render.com Entry Point for DiscoverGroup API
 * 
 * This script handles the build and start process for Render deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 DiscoverGroup API - Render Deployment');
console.log('========================================');

try {
  // Step 1: Check if build artifacts exist
  const buildDir = path.join(__dirname, 'dist-node/apps/api/src');
  
  if (!fs.existsSync(buildDir)) {
    console.log('📦 Build artifacts not found, running build process...');
    execSync('node scripts/build-api-deploy.js', { stdio: 'inherit' });
  } else {
    console.log('✅ Build artifacts found, skipping build step');
  }

  // Step 2: Start the API server
  console.log('🚀 Starting API server...');
  process.chdir(path.join(__dirname, 'dist-node/apps/api'));
  
  // Start the server directly
  require('./dist-node/apps/api/src/index.js');
  
} catch (error) {
  console.error('❌ Failed to start API server:', error);
  process.exit(1);
}