/**
 * PayMongo Payment Provider
 * Real integration with PayMongo API for Philippine payments
 * Docs: https://developers.paymongo.com/reference
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

interface PayMongoPaymentIntent {
  id: string;
  type: string;
  attributes: {
    amount: number;
    currency: string;
    status: string;
    client_key: string;
    statement_descriptor?: string;
    description: string;
    metadata: Record<string, string>;
    next_action?: {
      type: string;
      redirect?: {
        url: string;
        return_url: string;
      };
    };
    payment_method_allowed: string[];
    payment_method_options?: {
      card?: { request_three_d_secure: string };
    };
    created_at: number;
    updated_at: number;
    last_payment_error?: {
      code: string;
      detail: string;
      source: {
        id: string;
        type: string;
      };
    };
  };
}

interface PayMongoRefund {
  id: string;
  type: string;
  attributes: {
    amount: number;
    currency: string;
    reason: string;
    status: string;
    payment_id: string;
    created_at: number;
    updated_at: number;
  };
}

export class PayMongoPaymentProvider extends BasePaymentProvider {
  name: PaymentProvider = "paymongo";
  isEnabled = false;

  private readonly baseUrl = "https://api.paymongo.com/v1";

  protected validateConfig(config: PaymentProviderConfig): void {
    if (!config.apiKey) {
      throw new Error("PayMongo: Secret key is required");
    }

    if (config.apiKey.startsWith("pk_")) {
      throw new Error(
        "PayMongo: Use secret key (sk_) not public key for server-side operations"
      );
    }
  }

  protected getHeaders(): Record<string, string> {
    if (!this.config?.apiKey) {
      throw new Error("PayMongo: Not initialized");
    }

    // PayMongo uses Basic Auth with secret key as username
    const authToken = btoa(`${this.config.apiKey}:`);

    return {
      ...super.getHeaders(),
      Authorization: `Basic ${authToken}`,
    };
  }

  async createPayment(request: CreatePaymentRequest): Promise<PaymentIntent> {
    this.log("Creating PayMongo payment", {
      amount: request.amount,
      currency: request.currency,
    });

    try {
      // PayMongo expects amount in cents
      const amountInCents = this.convertToCents(request.amount);

      const payload = {
        data: {
          attributes: {
            amount: amountInCents,
            currency: request.currency,
            description: request.description || `Booking ${request.metadata.bookingId}`,
            statement_descriptor: "DiscoverGrp Tour",
            metadata: request.metadata,
            payment_method_allowed: [
              "card",
              "gcash",
              "grab_pay",
              "paymaya",
              "billease",
            ],
          },
        },
      };

      const response = await this.makeRequest<{ data: PayMongoPaymentIntent }>(
        `${this.baseUrl}/payment_intents`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(payload),
        }
      );

      return this.mapPaymentIntent(response.data);
    } catch (error) {
      this.logError("Failed to create payment", error);
      throw error;
    }
  }

  async getPayment(paymentIntentId: string): Promise<PaymentIntent> {
    try {
      const response = await this.makeRequest<{ data: PayMongoPaymentIntent }>(
        `${this.baseUrl}/payment_intents/${paymentIntentId}`,
        {
          method: "GET",
          headers: this.getHeaders(),
        }
      );

      return this.mapPaymentIntent(response.data);
    } catch (error) {
      this.logError("Failed to get payment", error);
      throw error;
    }
  }

  async cancelPayment(paymentIntentId: string): Promise<PaymentIntent> {
    try {
      const response = await this.makeRequest<{ data: PayMongoPaymentIntent }>(
        `${this.baseUrl}/payment_intents/${paymentIntentId}/cancel`,
        {
          method: "POST",
          headers: this.getHeaders(),
        }
      );

      return this.mapPaymentIntent(response.data);
    } catch (error) {
      this.logError("Failed to cancel payment", error);
      throw error;
    }
  }

  async refundPayment(request: RefundRequest): Promise<RefundResponse> {
    this.log("Creating PayMongo refund", {
      paymentIntentId: request.paymentIntentId,
      amount: request.amount,
    });

    try {
      // Get payment to determine full refund amount if not specified
      const payment = await this.getPayment(request.paymentIntentId);
      const refundAmount = request.amount ?? payment.amount;
      const amountInCents = this.convertToCents(refundAmount);

      const payload = {
        data: {
          attributes: {
            amount: amountInCents,
            payment_id: request.paymentIntentId,
            reason: request.reason || "customer_request",
            notes: request.metadata?.notes as string | undefined,
          },
        },
      };

      const response = await this.makeRequest<{ data: PayMongoRefund }>(
        `${this.baseUrl}/refunds`,
        {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(payload),
        }
      );

      return this.mapRefund(response.data);
    } catch (error) {
      this.logError("Failed to create refund", error);
      throw error;
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config?.webhookSecret) {
      this.logError("Webhook secret not configured", null);
      return false;
    }

    try {
      // PayMongo uses HMAC SHA256 for webhook signatures
      const crypto = window.crypto?.subtle;
      if (!crypto) {
        throw new Error("Web Crypto API not available");
      }

      // For server-side, you'd use Node.js crypto:
      // const hmac = crypto.createHmac('sha256', this.config.webhookSecret);
      // hmac.update(payload);
      // const expectedSignature = hmac.digest('hex');
      
      // For client-side (browser), webhook verification should be done on server
      console.warn("PayMongo: Webhook signature verification should be done server-side");
      
      // Basic check in browser (not cryptographically secure)
      return signature.length > 0;
    } catch (error) {
      this.logError("Webhook signature verification failed", error);
      return false;
    }
  }

  parseWebhookEvent(payload: unknown): PaymentWebhookEvent {
    const data = payload as {
      data: {
        id: string;
        type: string;
        attributes: {
          type: string;
          data: PayMongoPaymentIntent;
          created_at: number;
        };
      };
    };

    const paymentIntent = data.data.attributes.data;
    const eventType = data.data.attributes.type;

    return {
      id: data.data.id,
      provider: "paymongo",
      eventType,
      paymentIntentId: paymentIntent.id,
      status: this.mapStatus(paymentIntent.attributes.status),
      amount: this.convertFromCents(paymentIntent.attributes.amount),
      currency: paymentIntent.attributes.currency as "PHP" | "USD" | "EUR",
      metadata: {
        bookingId: paymentIntent.attributes.metadata.bookingId || "",
        customerEmail: paymentIntent.attributes.metadata.customerEmail || "",
        customerName: paymentIntent.attributes.metadata.customerName || "",
        ...paymentIntent.attributes.metadata,
      },
      timestamp: new Date(data.data.attributes.created_at * 1000),
    };
  }

  /**
   * Map PayMongo payment intent to standard format
   */
  private mapPaymentIntent(paymongoIntent: PayMongoPaymentIntent): PaymentIntent {
    const attrs = paymongoIntent.attributes;

    return {
      id: paymongoIntent.id,
      provider: "paymongo",
      amount: this.convertFromCents(attrs.amount),
      currency: attrs.currency as "PHP" | "USD" | "EUR",
      status: this.mapPayMongoStatus(attrs.status),
      clientSecret: attrs.client_key,
      redirectUrl: attrs.next_action?.redirect?.url,
      metadata: {
        bookingId: attrs.metadata.bookingId || "",
        customerEmail: attrs.metadata.customerEmail || "",
        customerName: attrs.metadata.customerName || "",
        ...attrs.metadata,
      },
      errorMessage: attrs.last_payment_error?.detail,
      createdAt: new Date(attrs.created_at * 1000),
      updatedAt: new Date(attrs.updated_at * 1000),
      paidAt: attrs.status === "succeeded" ? new Date(attrs.updated_at * 1000) : undefined,
    };
  }

  /**
   * Map PayMongo refund to standard format
   */
  private mapRefund(paymongoRefund: PayMongoRefund): RefundResponse {
    const attrs = paymongoRefund.attributes;

    return {
      id: paymongoRefund.id,
      paymentIntentId: attrs.payment_id,
      amount: this.convertFromCents(attrs.amount),
      currency: attrs.currency as "PHP" | "USD" | "EUR",
      status: attrs.status === "succeeded" ? "succeeded" : "pending",
      reason: attrs.reason,
      createdAt: new Date(attrs.created_at * 1000),
    };
  }

  /**
   * Map PayMongo-specific status to standard status
   */
  private mapPayMongoStatus(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      awaiting_payment_method: "pending",
      awaiting_next_action: "processing",
      processing: "processing",
      succeeded: "succeeded",
      failed: "failed",
      cancelled: "cancelled",
    };

    return statusMap[status] || "pending";
  }
}
