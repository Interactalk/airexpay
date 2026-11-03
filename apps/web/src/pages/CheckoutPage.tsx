import {
  buildPaymentUri,
  checkoutStatusCopy,
  DEMO_CHECKOUT_STATES,
  DEMO_INVOICES,
  isDemoCheckoutState,
  type DemoInvoice,
} from '@airexpay/shared';
import { Badge, Button, Card, CardContent } from '@airexpay/ui';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

function invoiceFromRoute(
  stateParam: string | undefined,
  publicId: string | undefined,
): DemoInvoice | null {
  if (stateParam && isDemoCheckoutState(stateParam)) {
    return DEMO_INVOICES[stateParam];
  }
  if (!publicId) return null;
  const match = DEMO_CHECKOUT_STATES.map((state) => DEMO_INVOICES[state]).find(
    (invoice) => invoice.publicId === publicId,
  );
  return match ?? null;
}

export function CheckoutPage() {
  const params = useParams();
  const invoice = invoiceFromRoute(params.state, params.publicId);
  if (!invoice) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16">
        <Card>
          <CardContent className="space-y-4 p-8">
            <h1 className="font-serif text-3xl">Checkout preview</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              This static shell does not look up live invoices. Open one of the simulated states. Do
              not send cryptocurrency to any address shown here.
            </p>
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
  return <CheckoutInvoice invoice={invoice} />;
}

function CheckoutInvoice({ invoice }: { invoice: DemoInvoice }) {
  const copy = checkoutStatusCopy(invoice.status);
  const payload = buildPaymentUri(invoice.payCurrency, invoice.payAddress, invoice.payAmount);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
                {invoice.status === 'underpaid' ? ` · seen ${invoice.actuallyPaid}` : ''}
              </p>
            </div>
            <Badge variant={invoice.status === 'paid' ? 'default' : 'outline'}>
              {invoice.status}
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
            variant={state === invoice.status ? 'default' : 'ghost'}
            asChild
          >
            <Link
              to={`/pay/demo/${state}`}
              aria-current={state === invoice.status ? 'page' : undefined}
            >
              {state}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
