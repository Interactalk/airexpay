import {
  ALLOWED_TRANSITIONS,
  applyPaymentTransition,
  emptyPaymentSnapshot,
  isTransitionAllowed,
  type PaymentSnapshot,
  type TransitionDeps,
} from '@airexpay/payment-core';
import { invoiceStatusFromPayment, PAYMENT_STATUSES, type PaymentStatus } from '@airexpay/shared';
import { describe, expect, it } from 'vitest';

const ORG = '11111111-1111-4111-8111-111111111111';

function deps(): TransitionDeps {
  let n = 0;
  return {
    now: () => '2026-11-03T06:00:00.000Z',
    id: () => `evt_${(n += 1)}`,
  };
}

function snapshotAt(status: PaymentStatus | null): PaymentSnapshot {
  return {
    ...emptyPaymentSnapshot(),
    status,
    payAmount: '0.01000000',
    actuallyPaid: status === null ? null : '0',
  };
}

function finishedTypes(events: { eventType: string }[]): string[] {
  return events
    .map((event) => event.eventType)
    .filter((type) => type === 'payment.finished' || type === 'invoice.paid');
}

describe('payment state machine', () => {
  it('exposes the explicit transition table from the payment lifecycle', () => {
    expect(ALLOWED_TRANSITIONS.waiting).toEqual([
      'confirming',
      'expired',
      'failed',
      'partially_paid',
      'finished',
    ]);
    expect(ALLOWED_TRANSITIONS.finished).toEqual(['refunded']);
    expect(ALLOWED_TRANSITIONS.failed).toEqual([]);
    expect(ALLOWED_TRANSITIONS.refunded).toEqual([]);
    expect(ALLOWED_TRANSITIONS.expired).toEqual(['partially_paid', 'finished']);
  });

  it('allows every listed transition and rejects every other pair', () => {
    const origins = ['new', ...PAYMENT_STATUSES] as const;
    for (const from of origins) {
      for (const to of PAYMENT_STATUSES) {
        const allowed = isTransitionAllowed(from, to);
        const start = snapshotAt(from === 'new' ? null : from);
        const before = start.events;
        const result = applyPaymentTransition(
          start,
          { to, source: 'ipn', organizationId: ORG, paymentId: 'pay_1' },
          deps(),
        );
        if (from !== 'new' && from === to) {
          expect(result.reason, `${from} -> ${to}`).toBe('already_in_status');
          expect(result.applied).toBe(false);
          expect(result.snapshot).toBe(start);
        } else if (allowed) {
          expect(result.applied, `${from} -> ${to}`).toBe(true);
          expect(result.snapshot.status).toBe(to);
          expect(result.invoiceStatus).toBe(invoiceStatusFromPayment(to));
          expect(result.invoiceStatus === 'paid').toBe(to === 'finished');
          expect(before).toHaveLength(0);
          expect(result.snapshot.events).toHaveLength(1);
          expect(Object.isFrozen(result.event)).toBe(true);
        } else {
          expect(result.applied, `${from} -> ${to}`).toBe(false);
          expect(result.reason, `${from} -> ${to}`).toBe('forbidden_transition');
          expect(result.snapshot).toBe(start);
          expect(result.audit?.action).toBe('payment.transition_rejected');
          expect(result.outboxEvents).toEqual([]);
        }
      }
    }
  });

  it('maps finished to paid and partially_paid to underpaid', () => {
    const paid = applyPaymentTransition(
      snapshotAt('waiting'),
      {
        to: 'finished',
        source: 'ipn',
        organizationId: ORG,
        paymentId: 'pay_paid',
        actuallyPaid: '0.01000000',
      },
      deps(),
    );
    expect(paid.invoiceStatus).toBe('paid');
    expect(paid.outboxEvents.map((event) => event.eventType)).toEqual([
      'payment.finished',
      'invoice.paid',
    ]);

    const under = applyPaymentTransition(
      snapshotAt('waiting'),
      {
        to: 'partially_paid',
        source: 'ipn',
        organizationId: ORG,
        paymentId: 'pay_under',
        actuallyPaid: '0.004',
      },
      deps(),
    );
    expect(under.invoiceStatus).toBe('underpaid');
    expect(finishedTypes(under.outboxEvents)).toEqual([]);
    expect(under.outboxEvents.map((event) => event.eventType)).toContain('invoice.underpaid');
  });

  it('never emits fulfillment for a non-finished status', () => {
    for (const status of PAYMENT_STATUSES) {
      if (!isTransitionAllowed('waiting', status) && status !== 'waiting') continue;
      if (status === 'waiting') continue;
      const result = applyPaymentTransition(
        snapshotAt('waiting'),
        { to: status, source: 'mock', organizationId: ORG, paymentId: `pay_${status}` },
        deps(),
      );
      expect(result.applied).toBe(true);
      const fulfillment = result.outboxEvents.some(
        (event) => event.eventType === 'payment.finished',
      );
      expect(fulfillment, status).toBe(status === 'finished');
      expect(result.invoiceStatus === 'paid').toBe(status === 'finished');
    }
  });

  it('protects terminal states and keeps prior events immutable', () => {
    const failed = applyPaymentTransition(
      snapshotAt('waiting'),
      { to: 'failed', source: 'ipn', organizationId: ORG, paymentId: 'pay_failed' },
      deps(),
    );
    const events = failed.snapshot.events;
    const blocked = applyPaymentTransition(
      failed.snapshot,
      { to: 'finished', source: 'ipn', organizationId: ORG, paymentId: 'pay_failed' },
      deps(),
    );
    expect(blocked.reason).toBe('forbidden_transition');
    expect(blocked.snapshot.status).toBe('failed');
    expect(blocked.snapshot.events).toBe(events);
    expect(events).toHaveLength(1);

    const refunded = applyPaymentTransition(
      snapshotAt('finished'),
      { to: 'refunded', source: 'admin', organizationId: ORG, paymentId: 'pay_ref' },
      deps(),
    );
    expect(refunded.applied).toBe(true);
    const stuck = applyPaymentTransition(
      refunded.snapshot,
      { to: 'finished', source: 'admin', organizationId: ORG, paymentId: 'pay_ref' },
      deps(),
    );
    expect(stuck.reason).toBe('forbidden_transition');
    expect(stuck.snapshot.status).toBe('refunded');
  });

  it('flags overpayment on finished and late payment after expiry', () => {
    const over = applyPaymentTransition(
      snapshotAt('confirming'),
      {
        to: 'finished',
        source: 'ipn',
        organizationId: ORG,
        paymentId: 'pay_over',
        payAmount: '0.01000000',
        actuallyPaid: '0.02',
      },
      deps(),
    );
    expect(over.invoiceStatus).toBe('paid');
    expect(over.snapshot.overpaid).toBe(true);
    expect(over.event?.overpaid).toBe(true);

    const late = applyPaymentTransition(
      snapshotAt('expired'),
      {
        to: 'finished',
        source: 'ipn',
        organizationId: ORG,
        paymentId: 'pay_late',
        actuallyPaid: '0.01000000',
      },
      deps(),
    );
    expect(late.applied).toBe(true);
    expect(late.snapshot.latePaymentReview).toBe(true);
    expect(late.invoiceStatus).toBe('paid');
  });

  it('does not mark confirming as paid along a normal path', () => {
    let snapshot = emptyPaymentSnapshot();
    for (const to of ['waiting', 'confirming', 'confirmed', 'sending'] as const) {
      const step = applyPaymentTransition(
        snapshot,
        {
          to,
          source: 'poll',
          organizationId: ORG,
          paymentId: 'pay_path',
          payAmount: '1',
          actuallyPaid: '0',
        },
        deps(),
      );
      expect(step.applied).toBe(true);
      expect(step.invoiceStatus).not.toBe('paid');
      snapshot = step.snapshot;
    }
    expect(snapshot.outbox.every((event) => event.eventType !== 'payment.finished')).toBe(true);
  });
});
