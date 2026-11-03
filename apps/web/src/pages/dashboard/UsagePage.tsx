import { sumMinor } from '@airexpay/payment-core';
import { Link } from 'react-router-dom';
import { ExampleTag } from '../../components/StatusBadge.tsx';
import { EXAMPLE_INVOICES } from '../../data/examples.ts';

function groupDecimal(value: string): string {
  const negative = value.startsWith('-');
  const body = negative ? value.slice(1) : value;
  const [whole, fraction] = body.split('.');
  const grouped = (whole ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const text = fraction !== undefined ? `${grouped}.${fraction}` : grouped;
  return negative ? `-${text}` : text;
}

export function UsagePage() {
  const paid = EXAMPLE_INVOICES.filter((invoice) => invoice.status === 'paid');
  const currencies = [...new Set(paid.map((invoice) => invoice.fee.currency))].sort();
  const totals = currencies.map((currency) => {
    const rows = paid.filter((invoice) => invoice.fee.currency === currency);
    const scale = rows[0]?.fee.minorScale ?? 2;
    return {
      currency,
      count: rows.length,
      providerFee: sumMinor(
        rows.map((invoice) => invoice.fee.providerFee),
        scale,
      ),
      margin: sumMinor(
        rows.map((invoice) => invoice.fee.margin),
        scale,
      ),
      totalFee: sumMinor(
        rows.map((invoice) => invoice.fee.totalFee),
        scale,
      ),
      networkFee: sumMinor(
        rows.map((invoice) => invoice.fee.networkFeeCharged),
        scale,
      ),
    };
  });

  return (
    <>
      <div className="ph">
        <div>
          <h1>Usage statement</h1>
          <p>November 2026. Fees that reached Paid, to be invoiced to the merchant.</p>
        </div>
        <ExampleTag>Example data</ExampleTag>
      </div>
      <div className="card" data-testid="usage-statement">
        <div className="sec">
          <p className="muted" style={{ fontSize: 13, margin: 0 }}>
            The configured provider cost is 1.5%. AirExpay multiplies that cost by 1.5, so the
            margin is 0.75% and the total merchant fee is 2.25%. On a 100.00 USD invoice that is a
            1.50 provider fee, a 0.75 margin, and a 2.25 total. Recheck the 1.5% provider rate
            against NOWPayments&apos; official pricing before go-live. The fee is billed monthly and
            is not deducted from the customer payment. Network fees are listed separately and are
            not marked up. Underpaid invoices are not charged. This preview does not hold funds and
            has no withdrawal.
          </p>
        </div>
        <table className="cl">
          <thead>
            <tr>
              <th>Invoice</th>
              <th className="r">Provider fee</th>
              <th className="r hm">Margin</th>
              <th className="r">Total fee</th>
              <th className="r hm">Network</th>
            </tr>
          </thead>
          <tbody>
            {paid.map((invoice) => (
              <tr key={invoice.id}>
                <td data-label="Invoice">
                  <Link className="num" to={`/dashboard/invoices/${invoice.id}`}>
                    {invoice.id}
                  </Link>
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    {invoice.fee.currency}
                  </div>
                </td>
                <td className="r num" data-label="Provider fee">
                  {groupDecimal(invoice.fee.providerFee)}
                </td>
                <td className="r num hm" data-label="Margin">
                  {groupDecimal(invoice.fee.margin)}
                </td>
                <td className="r num" data-label="Total fee" style={{ fontWeight: 600 }}>
                  {groupDecimal(invoice.fee.totalFee)}
                </td>
                <td className="r num hm" data-label="Network">
                  {groupDecimal(invoice.fee.networkFeeCharged)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="sec">
          <h3 style={{ marginTop: 0 }}>Month total by currency</h3>
          <ul className="ul" style={{ margin: 0 }} data-testid="usage-totals">
            {totals.map((total) => (
              <li key={total.currency}>
                <span>
                  {total.currency}: {groupDecimal(total.totalFee)} AirExpay fee ({total.count}{' '}
                  paid), network {groupDecimal(total.networkFee)} passed through. Provider cost{' '}
                  {groupDecimal(total.providerFee)}, margin {groupDecimal(total.margin)}.
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
