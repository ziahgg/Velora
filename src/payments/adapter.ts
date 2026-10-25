import * as Crypto from 'expo-crypto';

import type { PaymentResult } from '@/data/service';

/**
 * Payment boundary. The booking flow only talks to a PaymentAdapter, so a real
 * provider (e.g. Stripe PaymentSheet with a server-created PaymentIntent and a
 * webhook that confirms the booking) can replace the sandbox without touching
 * screens. The app never handles raw card numbers or CVVs, and never holds a
 * provider secret key.
 */
export interface PaymentMethod {
  id: string;
  kind: 'apple_pay' | 'card' | 'paypal';
  label: string;
  detail: string;
  /** Sandbox only: what this test method does. */
  sandboxOutcome: 'succeeds' | 'declines';
}

export interface ChargeRequest {
  bookingId: string;
  amountCents: number;
  method: PaymentMethod;
}

export interface PaymentAdapter {
  readonly isSandbox: boolean;
  listMethods(): PaymentMethod[];
  charge(request: ChargeRequest): Promise<PaymentResult>;
}

/** Test methods mirror the Figma list; the last one always declines so failure handling can be tested. */
const SANDBOX_METHODS: PaymentMethod[] = [
  { id: 'sbx-apple-pay', kind: 'apple_pay', label: 'Apple Pay', detail: 'Sandbox wallet', sandboxOutcome: 'succeeds' },
  { id: 'sbx-mastercard', kind: 'card', label: 'Mastercard', detail: '•••• •••• •••• 4444', sandboxOutcome: 'succeeds' },
  { id: 'sbx-paypal', kind: 'paypal', label: 'PayPal', detail: 'sandbox@velora.travel', sandboxOutcome: 'succeeds' },
  { id: 'sbx-declined', kind: 'card', label: 'Test card · declines', detail: '•••• •••• •••• 0002', sandboxOutcome: 'declines' },
];

export function methodLabel(m: PaymentMethod): string {
  const last4 = m.detail.match(/(\d{4})$/)?.[1];
  return `${m.label}${last4 ? ` ·· ${last4}` : ''} (sandbox)`;
}

export function createSandboxAdapter(delayMs = 1200): PaymentAdapter {
  return {
    isSandbox: true,
    listMethods: () => SANDBOX_METHODS,
    async charge({ method }) {
      await new Promise((r) => setTimeout(r, delayMs));
      const ref = `sbx_${Crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
      if (method.sandboxOutcome === 'declines') {
        return { status: 'declined', provider: 'sandbox', providerReference: ref, methodLabel: methodLabel(method), declineReason: 'card_declined' };
      }
      return { status: 'succeeded', provider: 'sandbox', providerReference: ref, methodLabel: methodLabel(method) };
    },
  };
}

export const payments: PaymentAdapter = createSandboxAdapter();
