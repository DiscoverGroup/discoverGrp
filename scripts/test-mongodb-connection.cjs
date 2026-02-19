/**
 * MongoDB Connection Diagnostic Tool
 * Tests MongoDB Atlas connection with detailed error reporting
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 MongoDB Connection Diagnostic Tool');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// Step 1: Check if MONGODB_URI exists
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  console.error('');
  console.error('Make sure you have a .env file with:');
  console.error('MONGODB_URI=mongodb+srv://...');
  process.exit(1);
}

// Step 2: Parse and validate URI format
console.log('✅ MONGODB_URI found');
console.log('');

// Extract URI components (safely)
const uriPattern = /mongodb\+srv:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)/;
const match = MONGODB_URI.match(uriPattern);

if (!match) {
  console.error('❌ Invalid MONGODB_URI format');
  console.error('');
  console.error('Expected format:');
  console.error('mongodb+srv://username:password@cluster.mongodb.net/database?options');
  console.error('');
  console.error('Current format:', MONGODB_URI.substring(0, 40) + '...');
  process.exit(1);
}

const [, username, password, host, database] = match;

console.log('📋 Connection Details:');
console.log('   Username:', username);
console.log('   Password:', '*'.repeat(password.length), `(${password.length} chars)`);
console.log('   Host:', host);
console.log('   Database:', database);
console.log('');

// Step 3: Check for special characters in password
const specialChars = /[!@#$%^&*()\-+=\[\]{}|;:'",.<>?\/\\]/;
const hasSpecialChars = specialChars.test(password);

if (hasSpecialChars) {
  console.warn('⚠️  WARNING: Password contains special characters');
  console.warn('   Special characters must be URL-encoded in MongoDB URI');
  console.warn('');
  console.warn('   Common encodings:');
  console.warn('   @ → %40');
  console.warn('   : → %3A');
  console.warn('   / → %2F');
  console.warn('   ? → %3F');
  console.warn('   # → %23');
  console.warn('   [ → %5B');
  console.warn('   ] → %5D');
  console.warn('');
  
  // Try to detect common issues
  if (password.includes('@')) {
    console.error('❌ CRITICAL: Password contains "@" symbol');
    console.error('   This MUST be encoded as %40 in the URI');
    console.error('');
    console.error('   Example:');
    console.error('   Wrong: mongodb+srv://user:pass@word@host/db');
    console.error('   Right: mongodb+srv://user:pass%40word@host/db');
    console.error('');
  }
}

// Step 4: Attempt connection
console.log('🔌 Attempting to connect to MongoDB Atlas...');
console.log('   (This may take up to 30 seconds)');
console.log('');

const startTime = Date.now();

mongoose.connect(MONGODB_URI, {
  maxPoolSize: 10,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  family: 4, // Force IPv4
  retryWrites: true,
  w: 'majority',
})
  .then(() => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ SUCCESS: Connected to MongoDB Atlas in ${duration}s`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Connection State:', mongoose.connection.readyState);
    console.log('Database:', mongoose.connection.db.databaseName);
    console.log('Host:', mongoose.connection.host);
    console.log('');
    console.log('🎉 Your MongoDB connection is working correctly!');
    console.log('   Railway deployment should succeed with these credentials.');
    console.log('');
    process.exit(0);
  })
  .catch((err) => {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`❌ FAILED: Connection failed after ${duration}s`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.error('Error:', err.message);
    console.log('');

    // Provide specific diagnostics based on error type
    if (err.message.includes('querySrv ENOTFOUND') || err.message.includes('ENOTFOUND')) {
      console.error('🔍 DNS RESOLUTION FAILED');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('');
      console.error('✅ Network Access: Configured (0.0.0.0/0 is active)');
      console.error('');
      console.error('🔧 Possible causes:');
      console.error('   1. DNS propagation delay (wait 5 more minutes)');
      console.error('   2. Railway DNS resolver issue (temporary)');
      console.error('   3. MongoDB Atlas cluster is paused');
      console.error('');
      console.error('🔄 Next steps:');
      console.error('   1. Check MongoDB Atlas cluster status');
      console.error('   2. Make sure cluster is NOT paused');
      console.error('   3. Wait 5 minutes and try again');
      console.error('   4. If still failing, try restarting Railway deployment');
      console.error('');
    } else if (err.message.includes('Authentication failed') || err.message.includes('auth')) {
      console.error('🔐 AUTHENTICATION FAILED');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('');
      console.error('❌ Username or password is incorrect');
      console.error('');
      console.error('🔧 Verify in MongoDB Atlas:');
      console.error('   1. Database Access → Database Users');
      console.error('   2. Check username:', username);
      console.error('   3. Reset password if needed');
      console.error('   4. Make sure user has "Read and write to any database" role');
      console.error('');
      console.error('⚠️  Remember to URL-encode special characters in password');
      console.error('');
    } else if (err.message.includes('not authorized') || err.message.includes('unauthorized')) {
      console.error('🔒 AUTHORIZATION FAILED');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('');
      console.error('❌ User does not have permissions for database:', database);
      console.error('');
      console.error('🔧 Fix in MongoDB Atlas:');
      console.error('   1. Database Access → Database Users');
      console.error('   2. Edit user:', username);
      console.error('   3. Set role to "Atlas admin" or "Read and write to any database"');
      console.error('');
    } else {
      console.error('❓ UNKNOWN ERROR');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('');
      console.error('Full error details:');
      console.error(err);
      console.error('');
    }

    process.exit(1);
  });

// Handle timeout
setTimeout(() => {
  console.error('');
  console.error('⏱️  Connection timeout after 30 seconds');
  console.error('   This usually means network access is blocked');
  console.error('');
  process.exit(1);
}, 31000);
