/**
 * Payment Service
 * Orchestrates payment operations across multiple providers
 */

import type {
  IPaymentProvider,
  PaymentProvider,
  PaymentIntent,
  CreatePaymentRequest,
  RefundRequest,
  RefundResponse,
  PaymentWebhookEvent,
  PaymentTransaction,
  PaymentStatus,
} from "../types/payment";

class PaymentService {
  private providers: Map<PaymentProvider, IPaymentProvider> = new Map();
  private defaultProvider: PaymentProvider = "demo";

  /**
   * Register a payment provider
   */
  registerProvider(provider: IPaymentProvider): void {
    this.providers.set(provider.name, provider);
    console.log(`✅ Registered payment provider: ${provider.name}`);
  }

  /**
   * Set default payment provider
   */
  setDefaultProvider(providerName: PaymentProvider): void {
    if (!this.providers.has(providerName)) {
      throw new Error(`Provider ${providerName} is not registered`);
    }
    this.defaultProvider = providerName;
  }

  /**
   * Get a specific provider
   */
  getProvider(providerName?: PaymentProvider): IPaymentProvider {
    const name = providerName || this.defaultProvider;
    const provider = this.providers.get(name);

    if (!provider) {
      throw new Error(`Payment provider ${name} not found`);
    }

    if (!provider.isEnabled) {
      throw new Error(`Payment provider ${name} is not enabled`);
    }

    return provider;
  }

  /**
   * Create a payment intent
   */
  async createPayment(
    request: CreatePaymentRequest,
    providerName?: PaymentProvider
  ): Promise<PaymentIntent> {
    const provider = this.getProvider(providerName);

    try {
      console.log(`💳 Creating payment with ${provider.name}:`, {
        amount: request.amount,
        currency: request.currency,
        bookingId: request.metadata.bookingId,
      });

      const paymentIntent = await provider.createPayment(request);

      // Store transaction record
      await this.storeTransaction(paymentIntent);

      return paymentIntent;
    } catch (error) {
      console.error(`❌ Payment creation failed:`, error);
      throw new Error(
        `Failed to create payment: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Get payment status
   */
  async getPayment(
    paymentIntentId: string,
    providerName?: PaymentProvider
  ): Promise<PaymentIntent> {
    const provider = this.getProvider(providerName);
    return provider.getPayment(paymentIntentId);
  }

  /**
   * Cancel a payment
   */
  async cancelPayment(
    paymentIntentId: string,
    providerName?: PaymentProvider
  ): Promise<PaymentIntent> {
    const provider = this.getProvider(providerName);
    return provider.cancelPayment(paymentIntentId);
  }

  /**
   * Refund a payment
   */
  async refundPayment(
    request: RefundRequest,
    providerName?: PaymentProvider
  ): Promise<RefundResponse> {
    const provider = this.getProvider(providerName);
    return provider.refundPayment(request);
  }

  /**
   * Handle webhook event
   */
  async handleWebhook(
    providerName: PaymentProvider,
    payload: string,
    signature: string,
    rawData: unknown
  ): Promise<PaymentWebhookEvent> {
    const provider = this.getProvider(providerName);

    // Verify webhook signature
    if (!provider.verifyWebhookSignature(payload, signature)) {
      throw new Error("Invalid webhook signature");
    }

    // Parse event
    const event = provider.parseWebhookEvent(rawData);

    // Process event
    await this.processWebhookEvent(event);

    return event;
  }

  /**
   * Process webhook event
   */
  private async processWebhookEvent(event: PaymentWebhookEvent): Promise<void> {
    console.log(`🔔 Processing webhook event:`, {
      provider: event.provider,
      type: event.eventType,
      paymentId: event.paymentIntentId,
      status: event.status,
    });

    try {
      // Update transaction status
      await this.updateTransactionStatus(
        event.paymentIntentId,
        event.status,
        event.metadata
      );

      // Handle specific events
      switch (event.status) {
        case "succeeded":
          await this.handlePaymentSuccess(event);
          break;
        case "failed":
          await this.handlePaymentFailure(event);
          break;
        case "refunded":
          await this.handlePaymentRefund(event);
          break;
        default:
          console.log(`⚠️ Unhandled payment status: ${event.status}`);
      }
    } catch (error) {
      console.error(`❌ Webhook processing failed:`, error);
      throw error;
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(event: PaymentWebhookEvent): Promise<void> {
    console.log(`✅ Payment succeeded:`, event.paymentIntentId);

    // Update booking payment status
    // In production, this would update your database
    if (event.metadata.bookingId) {
      console.log(`📝 Updating booking ${event.metadata.bookingId} as paid`);
      // TODO: Call your booking update API
      // await updateBookingPayment(event.metadata.bookingId, {
      //   paidAmount: event.amount,
      //   paymentIntentId: event.paymentIntentId,
      //   status: 'confirmed',
      // });
    }

    // Send confirmation email
    // TODO: Integrate with email service
    // await sendPaymentConfirmationEmail(event.metadata.customerEmail, {...});
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailure(event: PaymentWebhookEvent): Promise<void> {
    console.log(`❌ Payment failed:`, event.paymentIntentId);

    // Notify customer of failure
    // TODO: Send failure notification
    // await sendPaymentFailureEmail(event.metadata.customerEmail, {...});
  }

  /**
   * Handle payment refund
   */
  private async handlePaymentRefund(event: PaymentWebhookEvent): Promise<void> {
    console.log(`💰 Payment refunded:`, event.paymentIntentId);

    // Update booking status
    // TODO: Update booking to reflect refund
    // await updateBookingRefund(event.metadata.bookingId, event.amount);
  }

  /**
   * Store payment transaction
   */
  private async storeTransaction(paymentIntent: PaymentIntent): Promise<void> {
    const transaction: PaymentTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      paymentIntentId: paymentIntent.id,
      bookingId: paymentIntent.metadata.bookingId,
      provider: paymentIntent.provider,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // In production, store in database
    console.log(`💾 Storing transaction:`, transaction.id);
    // TODO: await db.transactions.create(transaction);
  }

  /**
   * Update transaction status
   */
  private async updateTransactionStatus(
    paymentIntentId: string,
    status: PaymentStatus
  ): Promise<void> {
    console.log(`🔄 Updating transaction status:`, {
      paymentIntentId,
      status,
    });

    // In production, update database
    // TODO: await db.transactions.update(
    //   { paymentIntentId },
    //   { status, updatedAt: new Date() }
    // );
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): PaymentProvider[] {
    return Array.from(this.providers.entries())
      .filter(([, provider]) => provider.isEnabled)
      .map(([name]) => name);
  }

  /**
   * Check if provider is available
   */
  isProviderAvailable(providerName: PaymentProvider): boolean {
    const provider = this.providers.get(providerName);
    return provider?.isEnabled ?? false;
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
export default paymentService;
