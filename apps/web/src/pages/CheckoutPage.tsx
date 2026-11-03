import { DEMO_CHECKOUT_STATES, isDemoCheckoutState, type InvoiceStatus } from '@airexpay/shared';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CheckoutError,
  createSimulationInvoice,
  fetchPublicCheckout,
  simulateCheckoutPayment,
  type PublicCheckout,
} from '../api/public-checkout.ts';
import { checkoutFromServer, exampleCheckout } from '../lib/checkout-model.ts';
import { CheckoutPanel } from './checkout/CheckoutPanel.tsx';

const SIMULATE_STATUSES = [
  'confirming',
  'finished',
  'partially_paid',
  'expired',
  'failed',
] as const;

export function CheckoutRoutes() {
  const params = useParams();
  if (params.state && isDemoCheckoutState(params.state)) {
    return <ExampleCheckout status={params.state} />;
  }
  if (!params.publicId) return <CreateCheckout />;
  return <LiveCheckout publicId={params.publicId} />;
}

function ExampleCheckout({ status }: { status: InvoiceStatus }) {
  return <CheckoutPanel view={exampleCheckout(status)} />;
}

function CreateCheckout() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('49.00');
  const [orderId, setOrderId] = useState('order-demo');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function createInvoice() {
    setPending(true);
    setError(null);
    try {
      const checkout = await createSimulationInvoice({ priceAmount: amount, orderId });
      navigate(`/pay/${checkout.public_id}`);
    } catch (caught) {
      setError(caught instanceof CheckoutError ? caught.message : 'The invoice was not created.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="ck-page">
      <main className="ck">
        <div className="panel">
          <div className="pad" style={{ display: 'grid', gap: 14 }}>
            <div>
              <h1 style={{ fontSize: 24, margin: '0 0 6px' }}>Simulated checkout</h1>
              <p className="muted" style={{ margin: 0 }}>
                This creates an invoice through the mock provider. No API key is sent from the
                browser. Do not send cryptocurrency.
              </p>
            </div>
            <label className="label">
              Amount (USD)
              <input
                className="input"
                style={{ width: '100%', marginTop: 6 }}
                value={amount}
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <label className="label">
              Order id
              <input
                className="input"
                style={{ width: '100%', marginTop: 6 }}
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
              />
            </label>
            {error ? (
              <p style={{ color: 'hsl(var(--status-underpaid-fg))', margin: 0 }}>{error}</p>
            ) : null}
            <button
              type="button"
              className="btn btn-primary btn-lg"
              disabled={pending}
              data-testid="create-invoice"
              onClick={() => void createInvoice()}
            >
              {pending ? 'Creating…' : 'Create invoice'}
            </button>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {DEMO_CHECKOUT_STATES.map((state) => (
                <Link key={state} className="btn btn-outline btn-sm" to={`/pay/demo/${state}`}>
                  {state}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function LiveCheckout({ publicId }: { publicId: string }) {
  const [checkout, setCheckout] = useState<PublicCheckout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simulateNote, setSimulateNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await fetchPublicCheckout(publicId);
      setCheckout(next);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof CheckoutError ? caught.message : 'The checkout service is not reachable.',
      );
    }
  }, [publicId]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      void fetchPublicCheckout(publicId).then(
        (next) => {
          if (!cancelled) {
            setCheckout(next);
            setError(null);
          }
        },
        (caught: unknown) => {
          if (cancelled) return;
          setError(
            caught instanceof CheckoutError
              ? caught.message
              : 'The checkout service is not reachable.',
          );
        },
      );
    };
    const kick = window.setTimeout(run, 0);
    const timer = window.setInterval(run, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(kick);
      window.clearInterval(timer);
    };
  }, [publicId]);

  async function simulate(paymentStatus: string) {
    setSimulating(true);
    setSimulateNote(null);
    try {
      await simulateCheckoutPayment(publicId, paymentStatus);
      await load();
    } catch (caught) {
      setSimulateNote(
        caught instanceof CheckoutError ? caught.message : 'The simulation was not accepted.',
      );
    } finally {
      setSimulating(false);
    }
  }

  if (error && !checkout) {
    return (
      <div className="ck-page">
        <main className="ck">
          <div className="panel">
            <div className="pad">
              <h1 style={{ fontSize: 24, marginTop: 0 }}>Checkout</h1>
              <p className="muted">{error}</p>
              <Link className="btn btn-primary" to="/pay">
                Create an invoice
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!checkout) {
    return (
      <div className="ck-page">
        <main className="ck">
          <p className="muted" style={{ textAlign: 'center' }}>
            Loading checkout…
          </p>
        </main>
      </div>
    );
  }

  return (
    <div>
      <CheckoutPanel view={checkoutFromServer(checkout)} onRefresh={() => void load()} />
      {import.meta.env.DEV ? (
        <div className="ck" style={{ display: 'grid', gap: 8, paddingTop: 0 }}>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            Dev only. The page shows paid only after the checkout endpoint returns paid.
          </p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {SIMULATE_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className="btn btn-outline btn-sm"
                disabled={simulating}
                data-testid={status === 'finished' ? 'simulate-payment' : undefined}
                onClick={() => void simulate(status)}
              >
                {simulating ? 'Sending…' : status}
              </button>
            ))}
          </div>
          {simulateNote ? (
            <p style={{ color: 'hsl(var(--status-underpaid-fg))' }}>{simulateNote}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
