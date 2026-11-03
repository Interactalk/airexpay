import { buildPaymentUri } from '@airexpay/shared';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import qrExample from '../../../../../design/assets/qr-example.png';
import { Icon } from '../../components/Icon.tsx';
import { ThemeToggle } from '../../theme.tsx';
import type { CheckoutView } from '../../lib/checkout-model.ts';

const STEPS = ['Send payment', 'Confirming', 'Done'] as const;

export function CheckoutPanel({ view, onRefresh }: { view: CheckoutView; onRefresh?: () => void }) {
  const [note, setNote] = useState<string | null>(null);
  const step = view.status === 'paid' ? 2 : view.status === 'confirming' ? 1 : 0;
  const showStepper =
    view.status === 'waiting' || view.status === 'confirming' || view.status === 'paid';

  return (
    <div className="ck-page">
      <div className="ck-wrap">
        <aside className="summary">
          <div>
            <div className="merchant" style={{ marginBottom: 40 }}>
              <div className="av" style={{ width: 30, height: 30, fontSize: 13, borderRadius: 7 }}>
                {view.merchantName.slice(0, 1)}
              </div>
              {view.merchantName}
            </div>
            <div className="muted">Invoice {view.invoiceRef}</div>
            <div
              className="num"
              style={{
                fontSize: 40,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                margin: '6px 0 28px',
              }}
            >
              {view.priceAmount} {view.priceCurrency}
            </div>
            <div style={{ borderTop: '1px solid hsl(var(--border))' }}>
              {(view.lineItems ?? []).map((item) => (
                <div
                  key={item.label}
                  className="row between"
                  style={{ padding: '14px 0', borderBottom: '1px solid hsl(var(--border))' }}
                >
                  <span>{item.label}</span>
                  <span className="num">{item.amount}</span>
                </div>
              ))}
              <div className="row between" style={{ padding: '14px 0', fontWeight: 600 }}>
                <span>Total</span>
                <span className="num">
                  {view.priceAmount} {view.priceCurrency}
                </span>
              </div>
            </div>
            <p className="muted" style={{ fontSize: 13, marginTop: 28 }}>
              Payments go directly to a wallet controlled by {view.merchantName}. AirExpay provides
              the payment software and does not hold funds.
            </p>
            <div style={{ marginTop: 16 }}>
              <ThemeToggle />
            </div>
          </div>
        </aside>
        <main className="ck">
          <div className="ckhead">
            <div className="merchant">
              <div className="av" style={{ width: 30, height: 30, fontSize: 13, borderRadius: 7 }}>
                {view.merchantName.slice(0, 1)}
              </div>
              {view.merchantName}
            </div>
            <span className="muted num" style={{ fontSize: 12.5 }}>
              {view.invoiceRef}
            </span>
          </div>
          <div className="exnote">
            {view.source === 'example' ? (
              <span className="example">Example — do not send funds</span>
            ) : (
              <span className="example">Simulation — do not send funds</span>
            )}
            <ThemeToggle className="btn btn-ghost btn-sm" />
          </div>
          <div className="panel">
            {view.status === 'waiting' ? <Waiting view={view} setNote={setNote} /> : null}
            {view.status === 'confirming' ? <Confirming view={view} /> : null}
            {view.status === 'paid' ? <Paid view={view} setNote={setNote} /> : null}
            {view.status === 'underpaid' ? <Underpaid view={view} setNote={setNote} /> : null}
            {view.status === 'expired' ? (
              <Expired view={view} onRefresh={onRefresh} setNote={setNote} />
            ) : null}
            {view.status === 'failed' ? <Failed view={view} setNote={setNote} /> : null}
            {view.status === 'refunded' || view.status === 'canceled' ? (
              <Terminal view={view} />
            ) : null}
            {showStepper ? (
              <div className="hr pad" style={{ padding: '14px 20px' }}>
                <div className="stepper" aria-label="Progress">
                  {STEPS.map((label, index) => (
                    <span key={label} className={index <= step ? 'on' : undefined}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          {note ? (
            <p
              className="muted"
              style={{ fontSize: 12.5, textAlign: 'center', marginTop: 10 }}
              role="status"
            >
              {note}
            </p>
          ) : null}
          <div className="ck-foot">
            <Icon name="lock" size={13} /> Non-custodial checkout by{' '}
            <b style={{ color: 'hsl(var(--foreground))' }}>AirExpay</b>
          </div>
        </main>
      </div>
    </div>
  );
}

function Waiting({ view, setNote }: { view: CheckoutView; setNote: (note: string) => void }) {
  return (
    <>
      <div className="pad">
        <div className="row between" style={{ marginBottom: 14 }}>
          <Badge view={view} />
          {view.countdown ? (
            <span
              className="row num"
              style={{ fontWeight: 600, fontSize: 14 }}
              aria-label={view.countdown.label}
            >
              <Icon name="clock" size={15} /> {view.countdown.clock}
            </span>
          ) : null}
        </div>
        <Amount view={view} />
        {view.sendCallout ? (
          <div className="callout" style={{ marginTop: 12, fontSize: 12.5 }}>
            {view.sendCallout}
          </div>
        ) : null}
        {view.source === 'server' ? <ServerCaution view={view} /> : null}
      </div>
      <div className="hr pad" style={{ paddingTop: 18 }}>
        <PayQr view={view} />
        <label className="label" style={{ marginTop: 16 }}>
          Payment address ({view.networkLabel})
        </label>
        <AddressRow view={view} setNote={setNote} />
        <div className="row" style={{ marginTop: 8, gap: 8 }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ flex: 1 }}
            onClick={() => void copyText(`${view.payAmount} ${view.payCurrency}`, setNote)}
          >
            <Icon name="copy" size={13} />
            Copy amount
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            style={{ flex: 1 }}
            onClick={() =>
              setNote(
                view.livemode
                  ? 'This build does not open a wallet.'
                  : 'Simulated checkout. No wallet was opened.',
              )
            }
          >
            Open in wallet
          </button>
        </div>
      </div>
    </>
  );
}

function Confirming({ view }: { view: CheckoutView }) {
  const width = view.confirmations
    ? `${Math.round((view.confirmations.current / view.confirmations.total) * 100)}%`
    : '40%';
  return (
    <>
      <div className="pad" style={{ textAlign: 'center' }}>
        <div
          className="icon-hero"
          style={{
            background: 'hsl(var(--status-confirming))',
            color: 'hsl(var(--status-confirming-fg))',
          }}
        >
          <Icon name="clock" size={24} />
        </div>
        <Badge view={view} />
        <h2 style={{ fontSize: 20, margin: '12px 0 4px' }} data-testid="checkout-title">
          {view.title}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {view.body}
        </p>
      </div>
      <div className="hr pad">
        <div className="row between" style={{ fontSize: 13, marginBottom: 8 }}>
          <span style={{ fontWeight: 500 }}>Network confirmations</span>
          <span className="num">
            {view.confirmations
              ? `${view.confirmations.current} of ${view.confirmations.total}`
              : 'Waiting'}
          </span>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-valuenow={view.confirmations?.current}
          aria-valuemax={view.confirmations?.total ?? 1}
          aria-label="Confirmations"
        >
          <i style={{ width }} />
        </div>
        <dl className="kv" style={{ margin: '16px 0 0', gridTemplateColumns: '110px 1fr' }}>
          <dt>Received</dt>
          <dd className="num" style={{ fontWeight: 500 }}>
            {view.actuallyPaid ?? view.payAmount} {view.payCurrency}
          </dd>
          {view.transactionHash ? (
            <>
              <dt>Transaction</dt>
              <dd className="mono break-anywhere" style={{ fontSize: 12, lineHeight: 1.45 }}>
                {view.transactionHash} <Icon name="ext" size={13} />
              </dd>
            </>
          ) : null}
          <dt>Typical time</dt>
          <dd>A few minutes; varies with network load</dd>
        </dl>
      </div>
    </>
  );
}

function Paid({ view, setNote }: { view: CheckoutView; setNote: (note: string) => void }) {
  return (
    <>
      <div className="pad" style={{ textAlign: 'center' }}>
        <div
          className="icon-hero"
          style={{ background: 'hsl(var(--status-paid))', color: 'hsl(var(--status-paid-fg))' }}
        >
          <Icon name="check" size={26} />
        </div>
        <Badge view={view} />
        <h2 style={{ fontSize: 20, margin: '12px 0 4px' }} data-testid="checkout-title">
          {view.title}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {view.body}
        </p>
      </div>
      <div className="hr pad">
        <dl className="kv" style={{ margin: 0, gridTemplateColumns: '110px 1fr' }}>
          <dt>Amount paid</dt>
          <dd className="num" style={{ fontWeight: 600 }}>
            {view.actuallyPaid ?? view.payAmount} {view.payCurrency}
          </dd>
          <dt>Network</dt>
          <dd>{view.networkLabel}</dd>
          <dt>Invoice</dt>
          <dd className="num">{view.invoiceRef}</dd>
          {view.paidAt ? (
            <>
              <dt>Paid at</dt>
              <dd className="num">{view.paidAt}</dd>
            </>
          ) : null}
          {view.transactionHash ? (
            <>
              <dt>Transaction</dt>
              <dd className="mono break-anywhere" style={{ fontSize: 12, lineHeight: 1.45 }}>
                {view.transactionHash} <Icon name="ext" size={13} />
              </dd>
            </>
          ) : null}
        </dl>
        <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => setNote('The merchant did not attach a return link.')}
          >
            Return to merchant
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setNote('Receipts are not available in this preview.')}
          >
            <Icon name="dl" size={14} />
            Download receipt
          </button>
        </div>
      </div>
    </>
  );
}

function Underpaid({ view, setNote }: { view: CheckoutView; setNote: (note: string) => void }) {
  return (
    <>
      <div className="pad">
        <div className="row between" style={{ marginBottom: 14 }}>
          <Badge view={view} />
          {view.countdown ? (
            <span
              className="row num"
              style={{ fontWeight: 600, fontSize: 14 }}
              aria-label={view.countdown.label}
            >
              <Icon name="clock" size={15} /> {view.countdown.clock}
            </span>
          ) : null}
        </div>
        <h2 style={{ fontSize: 20, margin: '0 0 4px' }} data-testid="checkout-title">
          {view.title}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {view.body}
        </p>
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
          <div className="callout">
            <div className="muted" style={{ fontSize: 12 }}>
              Invoice
            </div>
            <div className="num" style={{ fontWeight: 600 }}>
              {view.payAmount} {view.payCurrency}
            </div>
          </div>
          <div className="callout">
            <div className="muted" style={{ fontSize: 12 }}>
              Received
            </div>
            <div className="num" style={{ fontWeight: 600 }}>
              {view.actuallyPaid ?? '0'} {view.payCurrency}
            </div>
          </div>
        </div>
        {view.remaining ? (
          <div
            className="callout"
            style={{
              marginTop: 8,
              background: 'hsl(var(--status-underpaid))',
              borderColor: 'hsl(var(--status-underpaid-border))',
              color: 'hsl(var(--status-underpaid-fg))',
            }}
          >
            <div className="row between">
              <span style={{ fontWeight: 500 }}>Remaining to send</span>
              <span className="num" style={{ fontWeight: 700, fontSize: 18 }}>
                {view.remaining} {view.payCurrency}
              </span>
            </div>
          </div>
        ) : null}
      </div>
      <div className="hr pad">
        <label className="label">Same payment address ({view.networkLabel})</label>
        <AddressRow view={view} setNote={setNote} />
        <div className="row" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => setNote('The example QR does not encode a payable address.')}
          >
            Show QR for {view.remaining ?? view.payAmount} {view.payCurrency}
          </button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: '12px 0 0' }}>
          Can’t send more? Contact {view.merchantName} about a refund or adjustment. AirExpay does
          not hold funds and cannot refund on the merchant’s behalf.
        </p>
      </div>
    </>
  );
}

function Expired({
  view,
  onRefresh,
  setNote,
}: {
  view: CheckoutView;
  onRefresh?: () => void;
  setNote: (note: string) => void;
}) {
  return (
    <>
      <div className="pad" style={{ textAlign: 'center' }}>
        <div
          className="icon-hero"
          style={{
            background: 'hsl(var(--status-expired))',
            color: 'hsl(var(--status-expired-fg))',
          }}
        >
          <Icon name="clock" size={24} />
        </div>
        <Badge view={view} />
        <h2 style={{ fontSize: 20, margin: '12px 0 4px' }} data-testid="checkout-title">
          {view.title}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {view.body}
        </p>
      </div>
      <div className="hr pad">
        <div className="callout" style={{ marginBottom: 14 }}>
          Already sent a payment in the last few minutes? It may still be detected. Check again or
          contact the merchant with your transaction hash.
        </div>
        <button
          type="button"
          className="btn btn-primary btn-block btn-lg"
          onClick={() => setNote('Only the merchant can issue a new invoice.')}
        >
          Start a new payment
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          style={{ marginTop: 6 }}
          onClick={() => {
            onRefresh?.();
            setNote('Checked again. The status is whatever the server last reported.');
          }}
        >
          I already paid — check again
        </button>
      </div>
    </>
  );
}

function Failed({ view, setNote }: { view: CheckoutView; setNote: (note: string) => void }) {
  return (
    <>
      <div className="pad" style={{ textAlign: 'center' }}>
        <div
          className="icon-hero"
          style={{ background: 'hsl(var(--status-failed))', color: 'hsl(var(--status-failed-fg))' }}
        >
          <Icon name="alert" size={24} />
        </div>
        <Badge view={view} />
        <h2 style={{ fontSize: 20, margin: '12px 0 4px' }} data-testid="checkout-title">
          {view.title}
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          {view.body}
        </p>
      </div>
      <div className="hr pad">
        {view.failure ? (
          <dl className="kv" style={{ margin: '0 0 14px', gridTemplateColumns: '110px 1fr' }}>
            <dt>Expected</dt>
            <dd>{view.failure.expected}</dd>
            <dt>Detected</dt>
            <dd>{view.failure.detected}</dd>
            <dt>Transaction</dt>
            <dd className="mono break-anywhere" style={{ fontSize: 12, lineHeight: 1.45 }}>
              {view.transactionHash} <Icon name="ext" size={13} />
            </dd>
            <dt>Reference</dt>
            <dd className="mono">{view.failure.reference}</dd>
          </dl>
        ) : null}
        <button
          type="button"
          className="btn btn-primary btn-block btn-lg"
          onClick={() => setNote(`Contact ${view.merchantName}. AirExpay cannot move funds.`)}
        >
          Contact {view.merchantName}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-block"
          style={{ marginTop: 8 }}
          onClick={() =>
            void copyText(
              `${view.invoiceRef} ${view.failure?.reference ?? ''} ${view.transactionHash ?? ''}`.trim(),
              setNote,
            )
          }
        >
          <Icon name="copy" size={14} />
          Copy support details
        </button>
        <p className="muted" style={{ fontSize: 12.5, margin: '12px 0 0' }}>
          Funds sent go directly to the merchant’s wallet; only the merchant can help resolve it.
        </p>
      </div>
    </>
  );
}

function Terminal({ view }: { view: CheckoutView }) {
  return (
    <div className="pad" style={{ textAlign: 'center' }}>
      <Badge view={view} />
      <h2 style={{ fontSize: 20, margin: '12px 0 4px' }} data-testid="checkout-title">
        {view.title}
      </h2>
      <p className="muted" style={{ margin: 0 }}>
        {view.body}
      </p>
    </div>
  );
}

function Badge({ view }: { view: CheckoutView }) {
  return (
    <span
      className={`badge s-${view.status}`}
      data-testid="checkout-status"
      data-status={view.status}
    >
      {view.badgeLabel}
    </span>
  );
}

function Amount({ view }: { view: CheckoutView }) {
  return (
    <>
      <div className="muted" style={{ fontSize: 13 }}>
        Amount to send
      </div>
      <div className="amt num">
        {view.payAmount}{' '}
        <span className="muted" style={{ fontSize: 20, fontWeight: 500 }}>
          {view.payCurrency}
        </span>
      </div>
      <div className="muted num" style={{ fontSize: 13 }}>
        ≈ {view.priceAmount} {view.priceCurrency} · Network: {view.networkLabel}
      </div>
    </>
  );
}

function ServerCaution({ view }: { view: CheckoutView }) {
  if (view.livemode) return null;
  return (
    <div className="callout" style={{ marginTop: 12, fontSize: 12.5 }}>
      Simulation. Do not send cryptocurrency. This address is not monitored and cannot receive
      funds. Paid is shown only after the server reports status paid.
      {view.overpaid ? ' The provider reported an amount above the invoice.' : ''}
      {view.latePaymentReview ? ' A late payment was flagged for review.' : ''}
    </div>
  );
}

function AddressRow({ view, setNote }: { view: CheckoutView; setNote: (note: string) => void }) {
  return (
    <div className="addr">
      <span className="mono">{view.payAddress}</span>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => void copyText(view.payAddress, setNote)}
      >
        <Icon name="copy" size={13} />
        Copy
      </button>
    </div>
  );
}

function PayQr({ view }: { view: CheckoutView }) {
  if (view.source === 'example') {
    return (
      <img
        className="qr"
        src={qrExample}
        alt="QR code containing the example payment address"
        width={184}
        height={184}
      />
    );
  }
  return <LiveQr view={view} />;
}

function LiveQr({ view }: { view: CheckoutView }) {
  const payload = buildPaymentUri(view.payCurrency, view.payAddress, view.payAmount);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(payload, {
      margin: 1,
      width: 184,
      color: { dark: '#1c1917', light: '#ffffff' },
    }).then((url: string) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [payload]);
  if (!src) return <div className="qr" aria-hidden="true" />;
  return (
    <img
      className="qr"
      src={src}
      alt="Simulated payment QR code"
      width={184}
      height={184}
      data-qr-payload={payload}
    />
  );
}

async function copyText(value: string, setNote: (note: string) => void) {
  try {
    await navigator.clipboard.writeText(value);
    setNote('Copied');
  } catch {
    setNote('Copy is not available in this browser.');
  }
}
