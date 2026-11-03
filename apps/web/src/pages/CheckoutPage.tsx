import {
  buildPaymentUri,
  checkoutStatusCopy,
  DEMO_CHECKOUT_STATES,
  DEMO_INVOICES,
  isDemoCheckoutState,
  type DemoInvoice,
  type InvoiceStatus,
} from '@airexpay/shared';
import { Badge, Button, Card, CardContent } from '@airexpay/ui';
import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiUrl } from '../apiBase.ts';

interface PublicCheckout {
  public_id: string;
  status: InvoiceStatus;
  merchant_name: string;
  price_amount: string;
  price_currency: string;
  pay_amount: string;
  pay_currency: string;
  pay_address: string;
  actually_paid: string | null;
  description: string | null;
  network: string | null;
}

export function CheckoutPage() {
  const params = useParams();
  if (params.state && isDemoCheckoutState(params.state)) {
    return <CheckoutInvoice invoice={DEMO_INVOICES[params.state]} />;
  }
  if (!params.publicId) {
    return <CreateCheckout />;
  }
  const demo = DEMO_CHECKOUT_STATES.map((state) => DEMO_INVOICES[state]).find(
    (invoice) => invoice.publicId === params.publicId,
  );
  if (demo) return <CheckoutInvoice invoice={demo} />;
  return <LiveCheckout publicId={params.publicId} />;
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
      const response = await fetch(apiUrl('/api/dev/checkout/invoices'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': `idem_${crypto.randomUUID()}`,
        },
        body: JSON.stringify({
          price_amount: amount,
          price_currency: 'usd',
          pay_currency: 'btc',
          order_id: orderId,
          description: 'Simulated checkout',
        }),
      });
      if (!response.ok) {
        setError('The invoice was not created. Check the amount and try again.');
        return;
      }
      const body = (await response.json()) as PublicCheckout;
      navigate(`/pay/${body.public_id}`);
    } catch {
      setError('The simulation API is not reachable.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-16">
      <Card>
        <CardContent className="space-y-5 p-8">
          <div>
            <h1 className="font-serif text-3xl">Simulated checkout</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              This creates an invoice through the mock provider. No API key is sent from the
              browser. Do not send cryptocurrency.
            </p>
          </div>
          <label className="block text-sm">
            <span className="text-muted-foreground">Amount (USD)</span>
            <input
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Order id</span>
            <input
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2"
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-amber-900">{error}</p> : null}
          <Button
            type="button"
            onClick={() => void createInvoice()}
            disabled={pending}
            data-testid="create-invoice"
          >
            {pending ? 'Creating…' : 'Create invoice'}
          </Button>
          <div className="flex flex-wrap gap-2">
            {DEMO_CHECKOUT_STATES.map((state) => (
              <Button key={state} variant="outline" size="sm" asChild>
                <Link to={`/pay/demo/${state}`}>{state}</Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LiveCheckout({ publicId }: { publicId: string }) {
  const [checkout, setCheckout] = useState<PublicCheckout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simulateNote, setSimulateNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(apiUrl(`/v1/checkout/${publicId}`));
    if (!response.ok) {
      setCheckout(null);
      setError('This checkout was not found.');
      return;
    }
    setError(null);
    setCheckout((await response.json()) as PublicCheckout);
  }, [publicId]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      void load().catch(() => {
        if (!cancelled) setError('The simulation API is not reachable.');
      });
    };
    const kick = window.setTimeout(run, 0);
    const timer = window.setInterval(run, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(kick);
      window.clearInterval(timer);
    };
  }, [load]);

  async function simulate() {
    setSimulating(true);
    setSimulateNote(null);
    try {
      const response = await fetch(apiUrl(`/api/dev/checkout/${publicId}/simulate`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ payment_status: 'finished' }),
      });
      if (!response.ok) {
        setSimulateNote('The simulation was not accepted.');
      }
      await load();
    } catch {
      setSimulateNote('The simulation API is not reachable.');
    } finally {
      setSimulating(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <Card>
          <CardContent className="space-y-4 p-8">
            <h1 className="font-serif text-3xl">Checkout</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button asChild>
              <Link to="/pay">Create an invoice</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!checkout) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center text-sm text-muted-foreground">
        Loading checkout…
      </div>
    );
  }

  const invoice: DemoInvoice = {
    publicId: checkout.public_id,
    status: isDemoCheckoutState(checkout.status) ? checkout.status : 'waiting',
    priceAmount: checkout.price_amount,
    priceCurrency: checkout.price_currency,
    payAmount: checkout.pay_amount,
    payCurrency: checkout.pay_currency,
    payAddress: checkout.pay_address,
    merchant: checkout.merchant_name,
    description: checkout.description ?? 'Simulated invoice',
    actuallyPaid: checkout.actually_paid ?? '0',
  };

  return (
    <div>
      <CheckoutInvoice invoice={invoice} statusLabel={checkout.status} />
      {import.meta.env.DEV ? (
        <div className="mx-auto mt-4 flex max-w-lg flex-col items-center gap-2 px-5 pb-10">
          <Button
            type="button"
            variant="outline"
            onClick={() => void simulate()}
            disabled={simulating || checkout.status === 'paid'}
            data-testid="simulate-payment"
          >
            {simulating ? 'Sending simulation…' : 'Simulate payment'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Paid is shown only after the server reports status paid.
          </p>
          {simulateNote ? <p className="text-sm text-amber-900">{simulateNote}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function CheckoutInvoice({
  invoice,
  statusLabel,
}: {
  invoice: DemoInvoice;
  statusLabel?: InvoiceStatus;
}) {
  const copy = checkoutStatusCopy(statusLabel ?? invoice.status);
  const payload = buildPaymentUri(invoice.payCurrency, invoice.payAddress, invoice.payAmount);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const shownStatus = statusLabel ?? invoice.status;

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(payload, {
      margin: 1,
      width: 240,
      color: { dark: '#1c1917', light: '#ffffff' },
    }).then((url: string) => {
      if (!cancelled) setQr(url);
    });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  async function copyAddress() {
    await navigator.clipboard.writeText(invoice.payAddress);
    setCopied(true);
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-12">
      <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {invoice.merchant}
      </p>
      <h1 className="mt-2 text-center font-serif text-4xl">{copy.title}</h1>
      <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-muted-foreground">
        {copy.body}
      </p>

      <Card className="mt-8">
        <CardContent className="space-y-6 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Amount due</p>
              <p className="font-serif text-3xl">
                {invoice.priceAmount} {invoice.priceCurrency}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {invoice.payAmount} {invoice.payCurrency}
                {shownStatus === 'underpaid' ? ` · seen ${invoice.actuallyPaid}` : ''}
              </p>
            </div>
            <Badge
              variant={shownStatus === 'paid' ? 'default' : 'outline'}
              data-testid="checkout-status"
            >
              {shownStatus}
            </Badge>
          </div>

          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Simulation. Do not send cryptocurrency. This address is not monitored and cannot receive
            funds.
          </div>

          <div className="flex flex-col items-center gap-4">
            {qr ? (
              <img
                src={qr}
                alt="Simulated payment QR code"
                width={240}
                height={240}
                className="rounded-xl border border-border bg-white p-3"
                data-qr-payload={payload}
              />
            ) : (
              <div className="h-[240px] w-[240px] animate-pulse rounded-xl bg-muted" />
            )}
            <code className="w-full break-all rounded-xl bg-muted px-3 py-3 text-center text-xs">
              {invoice.payAddress}
            </code>
            <Button type="button" variant="outline" onClick={() => void copyAddress()}>
              {copied ? 'Copied' : 'Copy address'}
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">{invoice.description}</p>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {DEMO_CHECKOUT_STATES.map((state) => (
          <Button
            key={state}
            size="sm"
            variant={state === shownStatus ? 'default' : 'ghost'}
            asChild
          >
            <Link
              to={`/pay/demo/${state}`}
              aria-current={state === shownStatus ? 'page' : undefined}
            >
              {state}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
