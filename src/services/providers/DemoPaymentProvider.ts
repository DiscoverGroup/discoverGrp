/**
 * Demo Payment Provider
 * For testing and development - simulates payments without real transactions
 */

import { BasePaymentProvider } from "./BasePaymentProvider";
import type {
  PaymentProvider,
  PaymentIntent,
  CreatePaymentRequest,
  RefundRequest,
  RefundResponse,
  PaymentWebhookEvent,
  PaymentProviderConfig,
  PaymentStatus,
} from "../../types/payment";

export class DemoPaymentProvider extends BasePaymentProvider {
  name: PaymentProvider = "demo";
  isEnabled = true;

  private payments: Map<string, PaymentIntent> = new Map();
  private simulateDelay = 2000; // 2 seconds

  async initialize(config: PaymentProviderConfig): Promise<void> {
    this.config = config;
    this.isEnabled = config.enabled ?? true;
    this.log("Demo provider initialized (no real charges will be made)");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected validateConfig(_config: PaymentProviderConfig): void {
    // Demo provider doesn't need API keys
  }

  async createPayment(request: CreatePaymentRequest): Promise<PaymentIntent> {
    this.log("Creating demo payment", {
      amount: request.amount,
      currency: request.currency,
    });

    // Simulate network delay
    await this.sleep(this.simulateDelay);

    // Generate fake payment intent ID
    const paymentIntentId = `demo_pi_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const paymentIntent: PaymentIntent = {
      id: paymentIntentId,
      provider: "demo",
      amount: request.amount,
      currency: request.currency,
      status: "pending",
      clientSecret: `${paymentIntentId}_secret_${Math.random().toString(36).slice(2, 11)}`,
      redirectUrl: `${window.location.origin}/payment/demo/${paymentIntentId}`,
      metadata: request.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    // Store payment
    this.payments.set(paymentIntentId, paymentIntent);

    this.log("Demo payment created", { id: paymentIntentId });

    // Auto-succeed after 3 seconds (simulate user completing payment)
    setTimeout(() => {
      this.simulatePaymentSuccess(paymentIntentId);
    }, 3000);

    return paymentIntent;
  }

  async getPayment(paymentIntentId: string): Promise<PaymentIntent> {
    const payment = this.payments.get(paymentIntentId);

    if (!payment) {
      throw new Error(`Payment ${paymentIntentId} not found`);
    }

    return payment;
  }

  async cancelPayment(paymentIntentId: string): Promise<PaymentIntent> {
    const payment = await this.getPayment(paymentIntentId);

    if (payment.status === "succeeded") {
      throw new Error("Cannot cancel a succeeded payment");
    }

    payment.status = "cancelled";
    payment.updatedAt = new Date();

    this.payments.set(paymentIntentId, payment);
    this.log("Demo payment cancelled", { id: paymentIntentId });

    return payment;
  }

  async refundPayment(request: RefundRequest): Promise<RefundResponse> {
    const payment = await this.getPayment(request.paymentIntentId);

    if (payment.status !== "succeeded") {
      throw new Error("Can only refund succeeded payments");
    }

    const refundAmount = request.amount ?? payment.amount;
    if (refundAmount > payment.amount) {
      throw new Error("Refund amount exceeds payment amount");
    }

    // Simulate refund delay
    await this.sleep(this.simulateDelay);

    const refundId = `demo_rf_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const response: RefundResponse = {
      id: refundId,
      paymentIntentId: request.paymentIntentId,
      amount: refundAmount,
      currency: payment.currency,
      status: "succeeded",
      reason: request.reason,
      createdAt: new Date(),
    };

    // Update payment status
    payment.status = "refunded";
    payment.refundedAmount = refundAmount;
    payment.updatedAt = new Date();
    this.payments.set(request.paymentIntentId, payment);

    this.log("Demo payment refunded", {
      paymentId: request.paymentIntentId,
      refundId,
      amount: refundAmount,
    });

    return response;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    // Demo provider always accepts webhooks
    return true;
  }

  parseWebhookEvent(payload: unknown): PaymentWebhookEvent {
    const data = payload as {
      type: string;
      paymentIntentId: string;
      status: PaymentStatus;
      amount: number;
      currency: string;
      metadata: {
        bookingId: string;
        customerEmail: string;
        customerName: string;
        [key: string]: string;
      };
    };

    return {
      id: `evt_demo_${Date.now()}`,
      provider: "demo",
      eventType: data.type,
      paymentIntentId: data.paymentIntentId,
      status: data.status,
      amount: data.amount,
      currency: data.currency as "PHP" | "USD" | "EUR",
      metadata: data.metadata,
      timestamp: new Date(),
    };
  }

  /**
   * Simulate payment success (for testing)
   */
  private simulatePaymentSuccess(paymentIntentId: string): void {
    const payment = this.payments.get(paymentIntentId);

    if (!payment || payment.status !== "pending") {
      return;
    }

    payment.status = "succeeded";
    payment.paidAt = new Date();
    payment.updatedAt = new Date();
    this.payments.set(paymentIntentId, payment);

    this.log("Demo payment auto-succeeded", { id: paymentIntentId });

    // Trigger webhook event (in production, this would be sent to your webhook endpoint)
    const webhookEvent: PaymentWebhookEvent = {
      id: `evt_demo_${Date.now()}`,
      provider: "demo",
      eventType: "payment.succeeded",
      paymentIntentId,
      status: "succeeded",
      amount: payment.amount,
      currency: payment.currency,
      metadata: payment.metadata,
      timestamp: new Date(),
    };

    console.log("🔔 Demo webhook event:", webhookEvent);
  }

  /**
   * Simulate payment failure (for testing)
   */
  simulatePaymentFailure(paymentIntentId: string, errorMessage?: string): void {
    const payment = this.payments.get(paymentIntentId);

    if (!payment || payment.status !== "pending") {
      return;
    }

    payment.status = "failed";
    payment.errorMessage = errorMessage || "Simulated payment failure";
    payment.updatedAt = new Date();
    this.payments.set(paymentIntentId, payment);

    this.log("Demo payment failed", {
      id: paymentIntentId,
      error: payment.errorMessage,
    });
  }

  /**
   * Get all demo payments (for debugging)
   */
  getAllPayments(): PaymentIntent[] {
    return Array.from(this.payments.values());
  }

  /**
   * Clear all demo payments (for testing)
   */
  clearAllPayments(): void {
    this.payments.clear();
    this.log("All demo payments cleared");
  }
}
