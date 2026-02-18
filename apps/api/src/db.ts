import mongoose from 'mongoose';
import logger from './utils/logger';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/discovergroup';
const isProduction = process.env.NODE_ENV === 'production';

// Only log partial URI in production for security
if (isProduction) {
  logger.info('MongoDB URI configured: [REDACTED FOR SECURITY]');
} else {
  logger.info(`MongoDB URI configured: ${MONGODB_URI.substring(0, 30)}...`);
}

export const connectDB = async () => {
  // Return if already connected
  if (mongoose.connection.readyState === 1) {
    logger.info('✅ MongoDB already connected');
    return;
  }

  try {
    logger.info('Attempting to connect to MongoDB...');
    logger.info(`Connection string format: ${MONGODB_URI.startsWith('mongodb+srv') ? 'SRV (mongodb+srv://)' : 'Standard (mongodb://)'}`);
    
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 30000, // Increased from 10s to 30s
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000, // Added explicit connect timeout
      family: 4, // Force IPv4 (helps with DNS resolution issues)
      retryWrites: true,
      w: 'majority',
    });
    logger.info('✅ MongoDB connected successfully');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error('❌ MongoDB connection error:', errorMessage);
    
    // Provide detailed diagnostics
    if (errorMessage.includes('querySrv ENOTFOUND') || errorMessage.includes('ENOTFOUND')) {
      logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.error('🔍 DNS RESOLUTION FAILED - MongoDB Atlas Connection Issue');
      logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.error('');
      logger.error('This error means Railway CANNOT reach MongoDB Atlas.');
      logger.error('');
      logger.error('✅ IMMEDIATE FIX (5 minutes):');
      logger.error('   1. Go to: https://cloud.mongodb.com/v2');
      logger.error('   2. Click your cluster → Network Access');
      logger.error('   3. Click "Add IP Address"');
      logger.error('   4. Select "ALLOW ACCESS FROM ANYWHERE" (0.0.0.0/0)');
      logger.error('   5. Click "Confirm"');
      logger.error('   6. Wait 2 minutes for changes to propagate');
      logger.error('   7. Check Railway logs again');
      logger.error('');
      logger.error('🔒 SECURE ALTERNATIVE:');
      logger.error('   - Contact Railway support for static IP addresses');
      logger.error('   - Add those specific IPs to MongoDB Atlas whitelist');
      logger.error('');
      logger.error('💡 CONNECTION STRING FORMAT: ✅ CORRECT');
      logger.error(`   Format: ${MONGODB_URI.startsWith('mongodb+srv') ? 'mongodb+srv:// (SRV format)' : 'mongodb:// (standard)'}`);
      logger.error('');
      logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else if (errorMessage.includes('Authentication failed') || errorMessage.includes('auth failed')) {
      logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.error('🔐 AUTHENTICATION FAILED');
      logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.error('');
      logger.error('Check your MONGODB_URI credentials:');
      logger.error('   - Username is correct');
      logger.error('   - Password is correct (check for special characters)');
      logger.error('   - Database user has proper permissions');
      logger.error('');
      logger.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    // Only log connection string in development for debugging
    if (!isProduction) {
      logger.error('MONGODB_URI:', MONGODB_URI);
    }
    
    throw err; // Re-throw to let the server handle it
  }
};
