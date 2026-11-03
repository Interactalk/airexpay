import { useNavigate } from 'react-router-dom';
import type { ExampleInvoice } from '../data/examples.ts';
import { withQuery } from '../lib/chrome.ts';
import { StatusBadge } from './StatusBadge.tsx';

export function InvoiceTable({ invoices, search }: { invoices: ExampleInvoice[]; search: string }) {
  const navigate = useNavigate();
  return (
    <table className="cl">
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Status</th>
          <th className="r">Amount</th>
          <th className="hm">Network</th>
          <th className="hm">Created</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((invoice) => (
          <tr
            key={invoice.id}
            onClick={() => navigate(withQuery(`/dashboard/invoices/${invoice.id}`, search))}
            style={{ cursor: 'pointer' }}
          >
            <td data-label="Invoice">
              <div className="num" style={{ fontWeight: 500 }}>
                {invoice.id}
              </div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {invoice.customer}
              </div>
            </td>
            <td data-label="Status">
              <StatusBadge status={invoice.status} audience="dashboard" />
            </td>
            <td className="r num" data-label="Amount" style={{ fontWeight: 500 }}>
              {invoice.amount} <span className="muted">{invoice.asset}</span>
            </td>
            <td className="muted hm" data-label="Network">
              {invoice.network}
            </td>
            <td className="muted num hm" data-label="Created">
              {invoice.created}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
