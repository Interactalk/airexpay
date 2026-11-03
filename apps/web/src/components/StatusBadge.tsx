import type { InvoiceStatus } from '@airexpay/shared';
import { checkoutStatusLabel, dashboardStatusLabel } from '../lib/status.ts';

export function StatusBadge({
  status,
  audience,
  label,
}: {
  status: InvoiceStatus;
  audience: 'dashboard' | 'checkout';
  label?: string;
}) {
  const text =
    label ?? (audience === 'checkout' ? checkoutStatusLabel(status) : dashboardStatusLabel(status));
  return (
    <span className={`badge s-${status}`} data-status={status} data-testid="status-badge">
      {text}
    </span>
  );
}

export function ExampleTag({ children = 'Example' }: { children?: string }) {
  return <span className="example">{children}</span>;
}

export function LiveModePill() {
  return (
    <span className="livepill" data-testid="live-mode-pill">
      <span className="livedot" />
      Live mode
    </span>
  );
}
