/**
 * Payment Providers Configuration and Initialization
 */

import { paymentService } from "../paymentService";
import { DemoPaymentProvider } from "./DemoPaymentProvider";
import { PayMongoPaymentProvider } from "./PayMongoPaymentProvider";
import type { PaymentProvider } from "../../types/payment";

/**
 * Initialize all payment providers based on environment configuration
 */
export async function initializePaymentProviders(): Promise<void> {
  console.log("🔧 Initializing payment providers...");

  // Get environment configuration
  const env = {
    // PayMongo
    PAYMONGO_SECRET_KEY: import.meta.env.VITE_PAYMONGO_SECRET_KEY,
    PAYMONGO_PUBLIC_KEY: import.meta.env.VITE_PAYMONGO_PUBLIC_KEY,
    PAYMONGO_WEBHOOK_SECRET: import.meta.env.VITE_PAYMONGO_WEBHOOK_SECRET,

    // Dragonpay
    DRAGONPAY_MERCHANT_ID: import.meta.env.VITE_DRAGONPAY_MERCHANT_ID,
    DRAGONPAY_SECRET_KEY: import.meta.env.VITE_DRAGONPAY_SECRET_KEY,

    // Stripe (for international)
    STRIPE_SECRET_KEY: import.meta.env.VITE_STRIPE_SECRET_KEY,
    STRIPE_PUBLIC_KEY: import.meta.env.VITE_STRIPE_PUBLIC_KEY,
    STRIPE_WEBHOOK_SECRET: import.meta.env.VITE_STRIPE_WEBHOOK_SECRET,

    // PayPal
    PAYPAL_CLIENT_ID: import.meta.env.VITE_PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET: import.meta.env.VITE_PAYPAL_CLIENT_SECRET,

    // Mode
    PAYMENT_MODE: import.meta.env.VITE_PAYMENT_MODE || "demo", // demo, sandbox, production
    DEFAULT_PROVIDER: import.meta.env.VITE_DEFAULT_PAYMENT_PROVIDER || "demo",
  };

  // 1. Initialize Demo Provider (always available)
  const demoProvider = new DemoPaymentProvider();
  await demoProvider.initialize({
    enabled: env.PAYMENT_MODE === "demo",
    testMode: true,
  });
  paymentService.registerProvider(demoProvider);

  // 2. Initialize PayMongo
  if (env.PAYMONGO_SECRET_KEY) {
    try {
      const paymongoProvider = new PayMongoPaymentProvider();
      await paymongoProvider.initialize({
        apiKey: env.PAYMONGO_SECRET_KEY,
        publicKey: env.PAYMONGO_PUBLIC_KEY,
        webhookSecret: env.PAYMONGO_WEBHOOK_SECRET,
        enabled: true,
        testMode: env.PAYMENT_MODE === "sandbox",
      });
      paymentService.registerProvider(paymongoProvider);
    } catch (error) {
      console.error("❌ Failed to initialize PayMongo:", error);
    }
  }

  // 3. Initialize Dragonpay (to be implemented)
  // if (env.DRAGONPAY_MERCHANT_ID) {
  //   const dragonpayProvider = new DragonpayPaymentProvider();
  //   await dragonpayProvider.initialize({
  //     apiKey: env.DRAGONPAY_SECRET_KEY,
  //     publicKey: env.DRAGONPAY_MERCHANT_ID,
  //     enabled: true,
  //     testMode: env.PAYMENT_MODE === "sandbox",
  //   });
  //   paymentService.registerProvider(dragonpayProvider);
  // }

  // 4. Initialize Stripe (to be implemented)
  // if (env.STRIPE_SECRET_KEY) {
  //   const stripeProvider = new StripePaymentProvider();
  //   await stripeProvider.initialize({
  //     apiKey: env.STRIPE_SECRET_KEY,
  //     publicKey: env.STRIPE_PUBLIC_KEY,
  //     webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  //     enabled: true,
  //     testMode: env.PAYMENT_MODE === "sandbox",
  //   });
  //   paymentService.registerProvider(stripeProvider);
  // }

  // 5. Initialize PayPal (to be implemented)
  // if (env.PAYPAL_CLIENT_ID) {
  //   const paypalProvider = new PayPalPaymentProvider();
  //   await paypalProvider.initialize({
  //     apiKey: env.PAYPAL_CLIENT_SECRET,
  //     publicKey: env.PAYPAL_CLIENT_ID,
  //     enabled: true,
  //     testMode: env.PAYMENT_MODE === "sandbox",
  //   });
  //   paymentService.registerProvider(paypalProvider);
  // }

  // Set default provider
  const defaultProvider = env.DEFAULT_PROVIDER as PaymentProvider;
  if (paymentService.isProviderAvailable(defaultProvider)) {
    paymentService.setDefaultProvider(defaultProvider);
    console.log(`✅ Default payment provider: ${defaultProvider}`);
  } else {
    console.log("⚠️ Default provider not available, using demo");
    paymentService.setDefaultProvider("demo");
  }

  // Log available providers
  const availableProviders = paymentService.getAvailableProviders();
  console.log(`✅ Available payment providers:`, availableProviders);
}

/**
 * Get payment provider configuration status
 */
export function getProviderStatus(): {
  mode: string;
  defaultProvider: string;
  availableProviders: PaymentProvider[];
  configured: {
    paymongo: boolean;
    dragonpay: boolean;
    stripe: boolean;
    paypal: boolean;
    gcash: boolean;
    maya: boolean;
    xendit: boolean;
  };
} {
  return {
    mode: import.meta.env.VITE_PAYMENT_MODE || "demo",
    defaultProvider: import.meta.env.VITE_DEFAULT_PAYMENT_PROVIDER || "demo",
    availableProviders: paymentService.getAvailableProviders(),
    configured: {
      paymongo: !!import.meta.env.VITE_PAYMONGO_SECRET_KEY,
      dragonpay: !!import.meta.env.VITE_DRAGONPAY_MERCHANT_ID,
      stripe: !!import.meta.env.VITE_STRIPE_SECRET_KEY,
      paypal: !!import.meta.env.VITE_PAYPAL_CLIENT_ID,
      gcash: false, // GCash via PayMongo
      maya: false, // Maya via PayMongo
      xendit: false, // To be implemented
    },
  };
}
