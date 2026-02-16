/**
 * Payment Integration Types
 * Defines interfaces for payment provider integrations
 */

export type PaymentProvider = 
  | "paymongo" 
  | "dragonpay" 
  | "stripe" 
  | "paypal" 
  | "gcash" 
  | "maya"
  | "xendit"
  | "demo";

export type PaymentStatus = 
  | "pending" 
  | "processing" 
  | "succeeded" 
  | "failed" 
  | "cancelled" 
  | "expired"
  | "refunded";

export type Currency = "PHP" | "USD" | "EUR";

export interface PaymentMetadata {
  bookingId: string;
  customerEmail: string;
  customerName: string;
  tourSlug?: string;
  installmentId?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface PaymentIntent {
  id: string;
  provider: PaymentProvider;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  metadata: PaymentMetadata;
  clientSecret?: string;
  redirectUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  paidAt?: Date;
  errorMessage?: string;
  refundedAmount?: number;
}

export interface CreatePaymentRequest {
  amount: number;
  currency: Currency;
  metadata: PaymentMetadata;
  successUrl?: string;
  cancelUrl?: string;
  description?: string;
}

export interface PaymentWebhookEvent {
  id: string;
  provider: PaymentProvider;
  eventType: string;
  paymentIntentId: string;
  status: PaymentStatus;
  amount: number;
  currency: Currency;
  metadata: PaymentMetadata;
  rawData?: unknown;
  timestamp: Date;
  signature?: string;
}

export interface RefundRequest {
  paymentIntentId: string;
  amount?: number; // Partial refund if specified
  reason?: string;
  metadata?: Record<string, string>;
}

export interface RefundResponse {
  id: string;
  paymentIntentId: string;
  amount: number;
  currency: Currency;
  status: "pending" | "succeeded" | "failed";
  reason?: string;
  createdAt: Date;
}

/**
 * Payment Provider Interface
 * All payment providers must implement this interface
 */
export interface IPaymentProvider {
  readonly name: PaymentProvider;
  readonly isEnabled: boolean;

  /**
   * Initialize the provider with configuration
   */
  initialize(config: PaymentProviderConfig): Promise<void>;

  /**
   * Create a payment intent
   */
  createPayment(request: CreatePaymentRequest): Promise<PaymentIntent>;

  /**
   * Retrieve payment status
   */
  getPayment(paymentIntentId: string): Promise<PaymentIntent>;

  /**
   * Cancel/void a payment
   */
  cancelPayment(paymentIntentId: string): Promise<PaymentIntent>;

  /**
   * Process refund
   */
  refundPayment(request: RefundRequest): Promise<RefundResponse>;

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean;

  /**
   * Parse webhook event
   */
  parseWebhookEvent(payload: unknown): PaymentWebhookEvent;
}

export interface PaymentProviderConfig {
  enabled: boolean;
  testMode?: boolean;
  apiKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  publicKey?: string;
  merchantId?: string;
  environment?: "sandbox" | "production";
  apiVersion?: string;
  timeout?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface PaymentMethodDetails {
  id: string;
  type: string;
  brand?: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  holderName?: string;
  billingAddress?: {
    line1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export interface PaymentTransaction {
  id: string;
  paymentIntentId: string;
  bookingId: string;
  provider: PaymentProvider;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  paymentMethod?: PaymentMethodDetails;
  errorCode?: string;
  errorMessage?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
