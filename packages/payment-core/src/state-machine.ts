import { compareDecimal, invoiceStatusFromPayment, isPaymentStatus } from '@airexpay/shared';
import type { InvoiceStatus, PaymentStatus } from '@airexpay/shared';

/**
 * Explicit payment transition table.
 * Keep in sync with public.apply_payment_event() in supabase/migrations.
 *
 * (new)            → waiting
 * waiting          → confirming, expired, failed, partially_paid, finished
 * confirming       → confirmed, sending, partially_paid, finished, failed
 * confirmed        → sending, partially_paid, finished, failed
 * sending          → finished, partially_paid, failed
 * partially_paid   → finished, refunded, failed
 * finished         → refunded
 * expired          → partially_paid, finished
 * failed, refunded → terminal
 */
export const ALLOWED_TRANSITIONS = {
  new: ['waiting'],
  waiting: ['confirming', 'expired', 'failed', 'partially_paid', 'finished'],
  confirming: ['confirmed', 'sending', 'partially_paid', 'finished', 'failed'],
  confirmed: ['sending', 'partially_paid', 'finished', 'failed'],
  sending: ['finished', 'partially_paid', 'failed'],
  partially_paid: ['finished', 'refunded', 'failed'],
  finished: ['refunded'],
  expired: ['partially_paid', 'finished'],
  failed: [],
  refunded: [],
} as const satisfies Record<PaymentStatus | 'new', readonly PaymentStatus[]>;

export type TransitionSource = 'ipn' | 'poll' | 'mock' | 'admin';

export interface PaymentEvent {
  id: string;
  paymentId: string;
  organizationId: string;
  fromStatus: PaymentStatus | null;
  toStatus: PaymentStatus;
  source: TransitionSource;
  providerWebhookId?: string;
  createdAt: string;
  overpaid: boolean;
  latePaymentReview: boolean;
}

export interface OutboxEvent {
  id: string;
  organizationId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  publishedAt: string | null;
  attempts: number;
}

export interface AuditRecord {
  id: string;
  organizationId: string;
  action: string;
  target: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface PaymentSnapshot {
  status: PaymentStatus | null;
  payAmount: string | null;
  actuallyPaid: string | null;
  overpaid: boolean;
  latePaymentReview: boolean;
  events: PaymentEvent[];
  outbox: OutboxEvent[];
}

export interface TransitionInput {
  to: PaymentStatus;
  source: TransitionSource;
  organizationId: string;
  paymentId: string;
  providerWebhookId?: string;
  payAmount?: string | null;
  actuallyPaid?: string | null;
}

export interface TransitionDeps {
  now: () => string;
  id: () => string;
}

export type TransitionReason =
  'applied' | 'already_in_status' | 'forbidden_transition' | 'unknown_status' | 'invalid_amount';

export interface TransitionResult {
  applied: boolean;
  reason: TransitionReason;
  snapshot: PaymentSnapshot;
  invoiceStatus?: InvoiceStatus;
  event?: PaymentEvent;
  outboxEvents: OutboxEvent[];
  audit?: AuditRecord;
}

export function emptyPaymentSnapshot(): PaymentSnapshot {
  return {
    status: null,
    payAmount: null,
    actuallyPaid: null,
    overpaid: false,
    latePaymentReview: false,
    events: [],
    outbox: [],
  };
}

export function isTransitionAllowed(from: PaymentStatus | 'new', to: PaymentStatus): boolean {
  const row: readonly PaymentStatus[] = ALLOWED_TRANSITIONS[from];
  return row.includes(to);
}

function fulfillmentEvents(to: PaymentStatus): string[] {
  if (to === 'finished') {
    return ['payment.finished', 'invoice.paid'];
  }
  if (to === 'partially_paid') {
    return ['payment.partially_paid', 'invoice.underpaid'];
  }
  return [`payment.${to}`];
}

export function applyPaymentTransition(
  snapshot: PaymentSnapshot,
  input: TransitionInput,
  deps: TransitionDeps,
): TransitionResult {
  if (!isPaymentStatus(input.to)) {
    return {
      applied: false,
      reason: 'unknown_status',
      snapshot,
      outboxEvents: [],
    };
  }

  const from = snapshot.status;
  if (from === input.to) {
    return {
      applied: false,
      reason: 'already_in_status',
      snapshot,
      invoiceStatus: invoiceStatusFromPayment(from),
      outboxEvents: [],
    };
  }

  const fromKey: PaymentStatus | 'new' = from ?? 'new';
  if (!isTransitionAllowed(fromKey, input.to)) {
    return {
      applied: false,
      reason: 'forbidden_transition',
      snapshot,
      invoiceStatus: from ? invoiceStatusFromPayment(from) : undefined,
      outboxEvents: [],
      audit: {
        id: deps.id(),
        organizationId: input.organizationId,
        action: 'payment.transition_rejected',
        target: input.paymentId,
        createdAt: deps.now(),
        metadata: { from: fromKey, to: input.to, source: input.source },
      },
    };
  }

  let payAmount = snapshot.payAmount;
  let actuallyPaid = snapshot.actuallyPaid;
  try {
    if (input.payAmount) {
      compareDecimal(input.payAmount, '0');
      payAmount = input.payAmount;
    }
    if (input.actuallyPaid) {
      compareDecimal(input.actuallyPaid, '0');
      actuallyPaid = input.actuallyPaid;
    }
  } catch {
    return {
      applied: false,
      reason: 'invalid_amount',
      snapshot,
      outboxEvents: [],
    };
  }

  const overpaid =
    snapshot.overpaid ||
    (input.to === 'finished' &&
      payAmount !== null &&
      actuallyPaid !== null &&
      compareDecimal(actuallyPaid, payAmount) > 0);
  const latePaymentReview =
    snapshot.latePaymentReview ||
    (from === 'expired' && (input.to === 'finished' || input.to === 'partially_paid'));

  const createdAt = deps.now();
  const event: PaymentEvent = Object.freeze({
    id: deps.id(),
    paymentId: input.paymentId,
    organizationId: input.organizationId,
    fromStatus: from,
    toStatus: input.to,
    source: input.source,
    ...(input.providerWebhookId ? { providerWebhookId: input.providerWebhookId } : {}),
    createdAt,
    overpaid,
    latePaymentReview,
  });

  const invoiceStatus = invoiceStatusFromPayment(input.to);
  const outboxEvents = fulfillmentEvents(input.to).map((eventType) =>
    Object.freeze({
      id: deps.id(),
      organizationId: input.organizationId,
      eventType,
      payload: {
        payment_id: input.paymentId,
        from_status: from,
        to_status: input.to,
        invoice_status: invoiceStatus,
        overpaid,
        late_payment_review: latePaymentReview,
        source: input.source,
      },
      createdAt,
      publishedAt: null,
      attempts: 0,
    }),
  );

  const next: PaymentSnapshot = {
    status: input.to,
    payAmount,
    actuallyPaid,
    overpaid,
    latePaymentReview,
    events: [...snapshot.events, event],
    outbox: [...snapshot.outbox, ...outboxEvents],
  };

  return {
    applied: true,
    reason: 'applied',
    snapshot: next,
    invoiceStatus,
    event,
    outboxEvents,
  };
}
