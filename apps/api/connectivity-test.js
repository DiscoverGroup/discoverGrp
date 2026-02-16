const mongoose = require('mongoose');
const https = require('https');
const http = require('http');

// Load environment variables
require('dotenv').config();

console.log('🔍 Starting API & Services Connectivity Test...\n');

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
  environment: { status: 'pending', details: '' },
  mongodb: { status: 'pending', details: '' },
  sendgrid: { status: 'pending', details: '' },
  paymongo: { status: 'pending', details: '' },
  cloudflare: { status: 'pending', details: '' },
  apiServer: { status: 'pending', details: '' }
};

// Helper to make HTTPS requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data,
          headers: res.headers
        });
      });
    });
    
    request.on('error', reject);
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Request timeout after 10 seconds'));
    });
    
    if (options.body) {
      request.write(options.body);
    }
    
    request.end();
  });
}

// Helper to make HTTP requests to local server
function makeHttpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data,
          headers: res.headers
        });
      });
    });
    
    request.on('error', reject);
    request.setTimeout(5000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
    
    request.end();
  });
}

// 1. Environment Variables Check
async function testEnvironmentVariables() {
  log.test('Testing Environment Variables...');
  
  const criticalVars = ['JWT_SECRET', 'MONGODB_URI'];
  const optionalVars = ['SENDGRID_API_KEY', 'PAYMONGO_SECRET_KEY', 'R2_ACCESS_KEY_ID', 'EMAIL_USER', 'EMAIL_PASS'];
  
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
    log.info(`Present: ${present.join(', ')}`);
    results.environment = { status: 'success', details: `${present.length} variables configured` };
  } else {
    log.error(`Missing critical variables: ${missing.join(', ')}`);
    results.environment = { status: 'error', details: `Missing: ${missing.join(', ')}` };
  }
  
  // Show environment info
  log.info(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  log.info(`PORT: ${process.env.PORT || '4000'}`);
  
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
    const maskedUri = uri.includes('@') ? 
      uri.substring(0, 20) + '***' + uri.substring(uri.lastIndexOf('@')) :
      uri.substring(0, 30) + '...';
    log.info(`Connecting to: ${maskedUri}`);
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 8000,
    });
    
    // Test database operations
    const admin = mongoose.connection.db.admin();
    const pingResult = await admin.ping();
    const stats = await mongoose.connection.db.stats();
    
    log.success(`MongoDB connected successfully`);
    log.info(`Database: ${mongoose.connection.db.databaseName}`);
    log.info(`Collections: ${stats.collections || 'Unknown'}`);
    log.info(`Data size: ${stats.dataSize ? (stats.dataSize / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown'}`);
    
    results.mongodb = { 
      status: 'success', 
      details: `Connected to ${mongoose.connection.db.databaseName}` 
    };
    
  } catch (error) {
    log.error(`MongoDB connection failed: ${error.message}`);
    results.mongodb = { status: 'error', details: error.message };
  } finally {
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  
  console.log();
}

// 3. SendGrid Test
async function testSendGrid() {
  log.test('Testing SendGrid Email Service...');
  
  try {
    if (!process.env.SENDGRID_API_KEY) {
      log.warning('SENDGRID_API_KEY not configured');
      results.sendgrid = { status: 'warning', details: 'Not configured' };
      return;
    }
    
    // Test SendGrid API
    const response = await makeRequest('https://api.sendgrid.com/v3/user/account', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    if (response.statusCode === 200) {
      const accountData = JSON.parse(response.data);
      log.success('SendGrid connection successful');
      log.info(`Account type: ${accountData.type || 'Connected'}`);
      results.sendgrid = { status: 'success', details: 'API access verified' };
    } else {
      throw new Error(`SendGrid API returned ${response.statusCode}`);
    }
    
  } catch (error) {
    log.error(`SendGrid connection failed: ${error.message}`);
    results.sendgrid = { status: 'error', details: error.message };
  }
  
  console.log();
}

// 4. PayMongo Test
async function testPayMongo() {
  log.test('Testing PayMongo Payment Gateway...');
  
  try {
    if (!process.env.PAYMONGO_SECRET_KEY) {
      log.warning('PAYMONGO_SECRET_KEY not configured');
      results.paymongo = { status: 'warning', details: 'Not configured' };
      return;
    }
    
    const authHeader = Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64');
    
    // Test PayMongo API
    const response = await makeRequest('https://api.paymongo.com/v1/payment_methods', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
    
    if (response.statusCode === 200) {
      log.success('PayMongo connection successful');
      log.info('Payment methods endpoint accessible');
      results.paymongo = { status: 'success', details: 'API connection verified' };
    } else {
      throw new Error(`PayMongo API returned ${response.statusCode}`);
    }
    
  } catch (error) {
    log.error(`PayMongo connection failed: ${error.message}`);
    results.paymongo = { status: 'error', details: error.message };
  }
  
  console.log();
}

// 5. Cloudflare R2 Test (Basic)
async function testCloudflareR2() {
  log.test('Testing Cloudflare R2 Configuration...');
  
  try {
    const requiredVars = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ENDPOINT', 'R2_BUCKET_NAME'];
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      log.warning(`R2 not configured - missing: ${missing.join(', ')}`);
      results.cloudflare = { status: 'warning', details: `Missing: ${missing.join(', ')}` };
      return;
    }
    
    log.success('Cloudflare R2 environment configured');
    log.info(`Endpoint: ${process.env.R2_ENDPOINT}`);
    log.info(`Bucket: ${process.env.R2_BUCKET_NAME}`);
    log.info(`Public URL: ${process.env.R2_PUBLIC_URL || 'Not set'}`);
    
    results.cloudflare = { 
      status: 'success', 
      details: `Configured for bucket: ${process.env.R2_BUCKET_NAME}` 
    };
    
  } catch (error) {
    log.error(`Cloudflare R2 test failed: ${error.message}`);
    results.cloudflare = { status: 'error', details: error.message };
  }
  
  console.log();
}

// 6. API Server Test
async function testAPIServer() {
  log.test('Testing API Server Health...');
  
  try {
    const port = process.env.PORT || 4000;
    const baseUrl = `http://localhost:${port}`;
    
    log.info(`Testing server on ${baseUrl}`);
    
    // Test basic health endpoint
    const healthResponse = await makeHttpRequest(`${baseUrl}/health-simple`);
    
    if (healthResponse.statusCode === 200) {
      const data = JSON.parse(healthResponse.data);
      if (data.ok) {
        log.success('API server health check passed');
        
        // Try to get more detailed health info
        try {
          const detailedHealth = await makeHttpRequest(`${baseUrl}/health`);
          if (detailedHealth.statusCode === 200) {
            const healthData = JSON.parse(detailedHealth.data);
            log.info(`MongoDB status: ${healthData.mongodb?.status || 'Unknown'}`);
            log.info(`Uptime: ${Math.floor(healthData.uptime || 0)}s`);
          }
        } catch (e) {
          // Ignore detailed health check errors
        }
        
        results.apiServer = { status: 'success', details: 'Health endpoints responding' };
      } else {
        throw new Error('Health check returned ok: false');
      }
    } else {
      throw new Error(`Health endpoint returned ${healthResponse.statusCode}`);
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log.warning('API server not running - start with: npm run dev:api');
      results.apiServer = { status: 'warning', details: 'Server not running' };
    } else {
      log.error(`API server test failed: ${error.message}`);
      results.apiServer = { status: 'error', details: error.message };
    }
  }
  
  console.log();
}

// Generate Summary Report
function generateSummaryReport() {
  log.info('📊 CONNECTIVITY TEST SUMMARY');
  console.log('=' .repeat(60));
  
  let totalTests = 0;
  let passedTests = 0;
  let warningTests = 0;
  let failedTests = 0;
  
  Object.entries(results).forEach(([service, result]) => {
    totalTests++;
    const status = result.status;
    const statusIcon = status === 'success' ? '✅' : status === 'warning' ? '⚠️' : '❌';
    const statusColor = status === 'success' ? colors.green : status === 'warning' ? colors.yellow : colors.red;
    
    console.log(`${statusIcon} ${statusColor}${service.toUpperCase().padEnd(15)}${colors.reset}: ${result.details}`);
    
    if (status === 'success') passedTests++;
    else if (status === 'warning') warningTests++;
    else failedTests++;
  });
  
  console.log('=' .repeat(60));
  console.log(`📈 Results: ${totalTests} total | ✅ ${passedTests} passed | ⚠️ ${warningTests} warnings | ❌ ${failedTests} failed`);
  
  // Overall status and recommendations
  console.log();
  if (failedTests === 0) {
    if (warningTests === 0) {
      log.success('🎉 All services are connected and working properly!');
    } else {
      log.warning(`🎯 Core services working. ${warningTests} optional service(s) not configured.`);
    }
  } else {
    log.error(`🚨 ${failedTests} critical service(s) failed - immediate attention required!`);
  }
  
  // Provide specific recommendations
  console.log();
  log.info('📋 RECOMMENDATIONS:');
  
  if (results.apiServer.status === 'warning') {
    console.log('   • Start the API server: npm run dev:api');
  }
  
  if (results.mongodb.status === 'error') {
    console.log('   • Check MONGODB_URI in .env file');
    console.log('   • Ensure MongoDB Atlas cluster is running');
    console.log('   • Verify network access and IP whitelist');
  }
  
  if (results.sendgrid.status === 'warning') {
    console.log('   • Configure SENDGRID_API_KEY for email functionality');
  }
  
  if (results.paymongo.status === 'warning') {
    console.log('   • Configure PAYMONGO_SECRET_KEY for payment processing');
  }
  
  if (results.cloudflare.status === 'warning') {
    console.log('   • Configure Cloudflare R2 environment variables for file uploads');
  }
  
  console.log();
}

// Run all tests
async function runAllTests() {
  console.log(`🚀 Discover Group API Connectivity Test`);
  console.log(`📅 Started: ${new Date().toLocaleString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('=' .repeat(60));
  console.log();
  
  await testEnvironmentVariables();
  await testMongoDB();
  await testSendGrid();
  await testPayMongo();
  await testCloudflareR2();
  await testAPIServer();
  
  generateSummaryReport();
  
  log.info(`⏰ Test completed: ${new Date().toLocaleString()}`);
}

// Handle process cleanup
process.on('SIGINT', () => {
  console.log('\n\n🛑 Test interrupted by user');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error(`Unhandled rejection: ${reason}`);
});

// Run the tests
runAllTests().catch((error) => {
  log.error(`Test execution failed: ${error.message}`);
  process.exit(1);
});