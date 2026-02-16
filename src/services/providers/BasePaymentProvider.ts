/**
 * Base Payment Provider
 * Abstract class with common functionality for all payment providers
 */

import type {
  IPaymentProvider,
  PaymentProvider,
  PaymentIntent,
  CreatePaymentRequest,
  RefundRequest,
  RefundResponse,
  PaymentWebhookEvent,
  PaymentProviderConfig,
  PaymentStatus,
} from "../../types/payment";

export abstract class BasePaymentProvider implements IPaymentProvider {
  abstract name: PaymentProvider;
  abstract isEnabled: boolean;
  protected config?: PaymentProviderConfig;

  /**
   * Initialize the provider with configuration
   */
  async initialize(config: PaymentProviderConfig): Promise<void> {
    this.config = config;
    this.isEnabled = config.enabled;

    if (this.isEnabled) {
      await this.validateConfig(config);
      console.log(`✅ ${this.name} provider initialized`);
    } else {
      console.log(`⚠️ ${this.name} provider is disabled`);
    }
  }

  /**
   * Validate provider configuration
   */
  protected validateConfig(config: PaymentProviderConfig): void {
    if (!config.apiKey && !config.publicKey) {
      throw new Error(`${this.name}: API key or public key is required`);
    }

    if (config.webhookSecret && config.webhookSecret.length < 16) {
      throw new Error(`${this.name}: Webhook secret is too short`);
    }
  }

  /**
   * Get base headers for API requests
   */
  protected getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "User-Agent": "DiscoverGrp/1.0",
    };
  }

  /**
   * Make HTTP request with retry logic
   */
  protected async makeRequest<T>(
    url: string,
    options: RequestInit,
    retries = 3
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `HTTP ${response.status}: ${errorData.message || response.statusText}`
          );
        }

        return await response.json();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `${this.name} request failed (attempt ${attempt}/${retries}):`,
          lastError.message
        );

        if (attempt < retries) {
          // Exponential backoff
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new Error(
      `${this.name} request failed after ${retries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Sleep utility
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Convert amount to cents/smallest unit
   */
  protected convertToCents(amount: number): number {
    return Math.round(amount * 100);
  }

  /**
   * Convert amount from cents/smallest unit
   */
  protected convertFromCents(cents: number): number {
    return cents / 100;
  }

  /**
   * Generate idempotency key
   */
  protected generateIdempotencyKey(request: CreatePaymentRequest): string {
    const data = `${request.amount}-${request.currency}-${request.metadata.bookingId}-${Date.now()}`;
    return `idem_${this.hashString(data)}`;
  }

  /**
   * Simple string hash function
   */
  protected hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Map provider status to standard status
   */
  protected mapStatus(providerStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      // Common mappings
      pending: "pending",
      processing: "processing",
      succeeded: "succeeded",
      success: "succeeded",
      paid: "succeeded",
      completed: "succeeded",
      failed: "failed",
      error: "failed",
      cancelled: "cancelled",
      canceled: "cancelled",
      expired: "expired",
      refunded: "refunded",
    };

    const normalized = providerStatus.toLowerCase();
    return statusMap[normalized] || "pending";
  }

  /**
   * Log provider activity
   */
  protected log(message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.name}] ${message}`, data || "");
  }

  /**
   * Log provider errors
   */
  protected logError(message: string, error: unknown): void {
    const timestamp = new Date().toISOString();
    console.error(
      `[${timestamp}] [${this.name}] ❌ ${message}`,
      error instanceof Error ? error.message : error
    );
  }

  // Abstract methods that must be implemented by each provider
  abstract createPayment(request: CreatePaymentRequest): Promise<PaymentIntent>;
  abstract getPayment(paymentIntentId: string): Promise<PaymentIntent>;
  abstract cancelPayment(paymentIntentId: string): Promise<PaymentIntent>;
  abstract refundPayment(request: RefundRequest): Promise<RefundResponse>;
  abstract verifyWebhookSignature(payload: string, signature: string): boolean;
  abstract parseWebhookEvent(payload: unknown): PaymentWebhookEvent;
}
