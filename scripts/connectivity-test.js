#!/usr/bin/env node

/**
 * Comprehensive Connectivity Test for Discover Group API
 * Tests all 3rd party services and API endpoints
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import sgMail from '@sendgrid/mail';
import nodemailer from 'nodemailer';
import axios from 'axios';

console.log('🔍 Starting comprehensive connectivity test...\n');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  test: (msg) => console.log(`${colors.cyan}🧪 ${msg}${colors.reset}`)
};

// Test results tracking
const results = {
  mongodb: { status: 'pending', details: '' },
  cloudflareR2: { status: 'pending', details: '' },
  sendGrid: { status: 'pending', details: '' },
  gmail: { status: 'pending', details: '' },
  payMongo: { status: 'pending', details: '' },
  apiHealth: { status: 'pending', details: '' },
  environment: { status: 'pending', details: '' }
};

// 1. Environment Variables Check
async function testEnvironmentVariables() {
  log.test('Testing Environment Variables...');
  
  const criticalVars = ['JWT_SECRET', 'MONGODB_URI'];
  const optionalVars = ['SENDGRID_API_KEY', 'PAYMONGO_SECRET_KEY', 'R2_ACCESS_KEY_ID', 'EMAIL_USER'];
  
  let missing = [];
  let present = [];
  
  criticalVars.forEach(varName => {
    if (process.env[varName]) {
      present.push(varName);
    } else {
      missing.push(varName);
    }
  });
  
  optionalVars.forEach(varName => {
    if (process.env[varName]) {
      present.push(varName);
    }
  });
  
  if (missing.length === 0) {
    log.success(`Environment variables: ${present.length} configured`);
    results.environment = { status: 'success', details: `Variables: ${present.join(', ')}` };
  } else {
    log.error(`Missing critical variables: ${missing.join(', ')}`);
    results.environment = { status: 'error', details: `Missing: ${missing.join(', ')}` };
  }
  
  console.log();
}

// 2. MongoDB Connection Test
async function testMongoDB() {
  log.test('Testing MongoDB Connection...');
  
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI not configured');
    }
    
    // Show partial URI for security
    const uri = process.env.MONGODB_URI;
    const maskedUri = uri.substring(0, 20) + '***' + uri.substring(uri.lastIndexOf('@'));
    log.info(`Connecting to: ${maskedUri}`);
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000,
    });
    
    // Test database operations
    const admin = mongoose.connection.db.admin();
    const pingResult = await admin.ping();
    const stats = await mongoose.connection.db.stats();
    
    log.success(`MongoDB connected successfully`);
    log.info(`Database: ${mongoose.connection.db.databaseName}`);
    log.info(`Collections: ${stats.collections}`);
    log.info(`Data size: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);
    
    results.mongodb = { 
      status: 'success', 
      details: `DB: ${mongoose.connection.db.databaseName}, Collections: ${stats.collections}` 
    };
    
  } catch (error) {
    log.error(`MongoDB connection failed: ${error.message}`);
    results.mongodb = { status: 'error', details: error.message };
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
  }
  
  console.log();
}

// 3. Cloudflare R2 Storage Test
async function testCloudflareR2() {
  log.test('Testing Cloudflare R2 Storage...');
  
  try {
    if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_ENDPOINT) {
      throw new Error('R2 credentials not configured');
    }
    
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    
    const bucketName = process.env.R2_BUCKET_NAME || 'dg-website';
    log.info(`Testing bucket: ${bucketName}`);
    
    const command = new HeadBucketCommand({ Bucket: bucketName });
    await s3Client.send(command);
    
    log.success('Cloudflare R2 connection successful');
    log.info(`Public URL: ${process.env.R2_PUBLIC_URL || 'Not configured'}`);
    
    results.cloudflareR2 = { 
      status: 'success', 
      details: `Bucket: ${bucketName}, Endpoint: ${process.env.R2_ENDPOINT}` 
    };
    
  } catch (error) {
    log.error(`Cloudflare R2 connection failed: ${error.message}`);
    results.cloudflareR2 = { status: 'error', details: error.message };
  }
  
  console.log();
}

// 4. SendGrid Email Test
async function testSendGrid() {
  log.test('Testing SendGrid Email Service...');
  
  try {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error('SENDGRID_API_KEY not configured');
    }
    
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    // Test API key validity by making a simple API call
    const response = await fetch('https://api.sendgrid.com/v3/user/account', {
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`SendGrid API returned ${response.status}: ${response.statusText}`);
    }
    
    const accountData = await response.json();
    
    log.success('SendGrid connection successful');
    log.info(`Account type: ${accountData.type || 'Unknown'}`);
    
    results.sendGrid = { 
      status: 'success', 
      details: `Account: ${accountData.type || 'Connected'}` 
    };
    
  } catch (error) {
    log.error(`SendGrid connection failed: ${error.message}`);
    results.sendGrid = { status: 'error', details: error.message };
  }
  
  console.log();
}

// 5. Gmail SMTP Test
async function testGmail() {
  log.test('Testing Gmail SMTP Service...');
  
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      log.warning('Gmail SMTP credentials not configured (EMAIL_USER/EMAIL_PASS)');
      results.gmail = { status: 'warning', details: 'Not configured - using fallback' };
      return;
    }
    
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    
    // Verify connection
    await transporter.verify();
    
    log.success('Gmail SMTP connection successful');
    log.info(`Email: ${process.env.EMAIL_USER}`);
    
    results.gmail = { 
      status: 'success', 
      details: `Email: ${process.env.EMAIL_USER}` 
    };
    
  } catch (error) {
    log.error(`Gmail SMTP connection failed: ${error.message}`);
    results.gmail = { status: 'error', details: error.message };
  }
  
  console.log();
}

// 6. PayMongo Payment Gateway Test
async function testPayMongo() {
  log.test('Testing PayMongo Payment Gateway...');
  
  try {
    if (!process.env.PAYMONGO_SECRET_KEY) {
      log.warning('PAYMONGO_SECRET_KEY not configured');
      results.payMongo = { status: 'warning', details: 'Not configured' };
      return;
    }
    
    const authHeader = `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`;
    
    // Test API connection by fetching payment methods
    const response = await fetch('https://api.paymongo.com/v1/payment_methods', {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`PayMongo API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    log.success('PayMongo connection successful');
    log.info(`API responsive - Payment methods endpoint accessible`);
    
    results.payMongo = { 
      status: 'success', 
      details: 'API connection verified' 
    };
    
  } catch (error) {
    log.error(`PayMongo connection failed: ${error.message}`);
    results.payMongo = { status: 'error', details: error.message };
  }
  
  console.log();
}

// 7. API Health Endpoints Test
async function testAPIHealth() {
  log.test('Testing API Health Endpoints...');
  
  try {
    const port = process.env.PORT || 4000;
    const baseUrl = `http://localhost:${port}`;
    
    log.info(`Testing health endpoints on ${baseUrl}`);
    
    // The API might not be running, so we'll check if we can test it
    try {
      // Test basic health endpoint
      const healthResponse = await axios.get(`${baseUrl}/health`, { timeout: 5000 });
      
      if (healthResponse.data.ok) {
        log.success('API health endpoint responding');
        log.info(`MongoDB status: ${healthResponse.data.mongodb.status}`);
        log.info(`Uptime: ${Math.floor(healthResponse.data.uptime)}s`);
        
        results.apiHealth = { 
          status: 'success', 
          details: `Health check passed, Uptime: ${Math.floor(healthResponse.data.uptime)}s` 
        };
      } else {
        throw new Error('Health endpoint returned ok: false');
      }
      
    } catch (connectError) {
      if (connectError.code === 'ECONNREFUSED') {
        log.warning('API server not running - cannot test health endpoints');
        results.apiHealth = { status: 'warning', details: 'Server not running' };
      } else {
        throw connectError;
      }
    }
    
  } catch (error) {
    log.error(`API Health test failed: ${error.message}`);
    results.apiHealth = { status: 'error', details: error.message };
  }
  
  console.log();
}

// Generate Summary Report
function generateSummaryReport() {
  log.info('📊 CONNECTIVITY TEST SUMMARY');
  console.log('=' .repeat(50));
  
  let totalTests = 0;
  let passedTests = 0;
  let warningTests = 0;
  let failedTests = 0;
  
  Object.entries(results).forEach(([service, result]) => {
    totalTests++;
    const status = result.status;
    const statusIcon = status === 'success' ? '✅' : status === 'warning' ? '⚠️' : '❌';
    const statusColor = status === 'success' ? colors.green : status === 'warning' ? colors.yellow : colors.red;
    
    console.log(`${statusIcon} ${statusColor}${service.toUpperCase()}${colors.reset}: ${result.details}`);
    
    if (status === 'success') passedTests++;
    else if (status === 'warning') warningTests++;
    else failedTests++;
  });
  
  console.log('=' .repeat(50));
  console.log(`📈 Total: ${totalTests} | ✅ Passed: ${passedTests} | ⚠️ Warnings: ${warningTests} | ❌ Failed: ${failedTests}`);
  
  // Overall status
  if (failedTests === 0) {
    if (warningTests === 0) {
      log.success('🎉 All services are connected and working properly!');
    } else {
      log.warning(`🎯 Core services working, ${warningTests} optional service(s) not configured`);
    }
  } else {
    log.error(`🚨 ${failedTests} critical service(s) failed - immediate attention required!`);
  }
  
  console.log();
}

// Run all tests
async function runAllTests() {
  console.log(`🚀 Discover Group API Connectivity Test`);
  console.log(`📅 Started: ${new Date().toLocaleString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('=' .repeat(50));
  console.log();
  
  await testEnvironmentVariables();
  await testMongoDB();
  await testCloudflareR2();
  await testSendGrid();
  await testGmail();
  await testPayMongo();
  await testAPIHealth();
  
  generateSummaryReport();
  
  log.info(`⏰ Test completed: ${new Date().toLocaleString()}`);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log.error(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

// Run the tests
runAllTests().catch(console.error);