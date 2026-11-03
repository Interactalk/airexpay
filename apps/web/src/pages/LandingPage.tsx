import { Button, Card, CardContent, CardHeader, CardTitle } from '@airexpay/ui';
import { Link } from 'react-router-dom';

const included = [
  {
    title: 'Simulated invoices',
    body: 'Create an invoice against the in-memory mock provider. Amounts stay decimal strings.',
  },
  {
    title: 'Hosted checkout preview',
    body: 'Review waiting, confirming, paid, underpaid, expired, and failed without sending coins.',
  },
  {
    title: 'Signed status updates',
    body: 'Provider notifications are verified, stored, and applied through an explicit state machine.',
  },
];

const excluded = [
  'No custody of customer funds, balances, or payouts',
  'No live NOWPayments, Stripe, or BitPay calls',
  'No statement of fees, settlement time, or licensing',
  'No claim that a partially paid invoice is fulfilled',
];

export function LandingPage() {
  return (
    <div>
      <section className="mx-auto max-w-5xl px-5 pb-8 pt-16 sm:pt-24">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">AirexPay LLC</p>
        <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          Payment software that leaves the wallet with the merchant.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          AirExpay is a non-custodial crypto payment gateway in development. This Phase 1 release
          runs entirely in simulation. Invoices, checkout, and provider notifications use a mock
          processor. Live payments are not authorized.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/pay/demo/waiting">Open a simulated checkout</Link>
          </Button>
          <Button variant="outline" asChild>
            <a href="#boundaries">What this release is not</a>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-5 py-10 sm:grid-cols-3">
        {included.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle className="text-xl">{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section id="boundaries" className="mx-auto max-w-5xl px-5 py-8">
        <div className="rounded-3xl border border-border bg-card px-6 py-8 sm:px-10">
          <h2 className="font-serif text-3xl">Boundaries</h2>
          <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            {excluded.map((item) => (
              <li key={item} className="rounded-2xl bg-muted px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Only a provider status of finished is treated as paid. A partially paid update becomes
            underpaid and is not fulfilled. NOWPayments eligibility for a US company is unresolved;
            the adapter stays on the mock provider until there is written approval.
          </p>
        </div>
      </section>
    </div>
  );
}
