import { useState } from 'react';
import { Icon } from '../../components/Icon.tsx';
import { ExampleTag } from '../../components/StatusBadge.tsx';
import { EXAMPLE_MEMBERS } from '../../data/examples.ts';

const TABS = ['Business', 'Settlement addresses', 'Team', 'Security', 'Notifications'] as const;
const ROLES = ['Owner', 'Admin', 'Developer', 'Viewer'] as const;

export function SettingsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Team');
  const [require2fa, setRequire2fa] = useState(true);
  const [addressApproval, setAddressApproval] = useState(true);
  const [roles, setRoles] = useState(() => EXAMPLE_MEMBERS.map((member) => member.role));
  const [note, setNote] = useState<string | null>(null);

  return (
    <>
      <div className="ph">
        <div>
          <h1>Settings &amp; team</h1>
          <p>Business profile, settlement addresses and who can access this account.</p>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label="Settings">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={`tab${tab === item ? ' on' : ''}`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === 'Team' ? (
        <div className="grid g2" style={{ gridTemplateColumns: '1fr 320px', alignItems: 'start' }}>
          <div className="card">
            <div className="sec row between">
              <div>
                <h3>Members</h3>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  4 of 10 seats used
                </div>
              </div>
              <div className="row">
                <ExampleTag>Example data</ExampleTag>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setNote('Invites are not sent from this preview.')}
                >
                  <Icon name="plus" size={13} />
                  Invite member
                </button>
              </div>
            </div>
            <table className="cl">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th className="hm">Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {EXAMPLE_MEMBERS.map((member, index) => (
                  <tr key={member.email + member.name}>
                    <td data-label="Member">
                      <div className="row">
                        <div
                          className="av"
                          style={{
                            background: 'hsl(var(--muted))',
                            color: 'hsl(var(--foreground))',
                          }}
                        >
                          {member.initial}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{member.name}</div>
                          <div className="muted" style={{ fontSize: 12.5 }}>
                            {member.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td data-label="Role">
                      <label className="sr-only" htmlFor={`role-${index}`}>
                        Role for {member.name}
                      </label>
                      <select
                        id={`role-${index}`}
                        className="input"
                        style={{ height: 44, width: 140 }}
                        value={roles[index] ?? member.role}
                        onChange={(event) =>
                          setRoles((current) =>
                            current.map((role, roleIndex) =>
                              roleIndex === index ? event.target.value : role,
                            ),
                          )
                        }
                      >
                        {ROLES.map((role) => (
                          <option key={role}>{role}</option>
                        ))}
                      </select>
                    </td>
                    <td className="hm" data-label="Status">
                      <span
                        className={`badge ${member.status === 'Active' ? 's-paid' : 's-waiting'}`}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td data-label="">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        aria-label={`Actions for ${member.name}`}
                        onClick={() => setNote('Member actions stay in this preview.')}
                      >
                        <Icon name="dots" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid">
            <div className="card" style={{ padding: '16px 18px' }}>
              <h3>Roles</h3>
              <dl
                className="kv"
                style={{ gridTemplateColumns: '90px 1fr', margin: '10px 0 0', fontSize: 13 }}
              >
                <dt>Owner</dt>
                <dd>Everything, incl. billing and deleting the account</dd>
                <dt>Admin</dt>
                <dd>Manage team, settings, addresses</dd>
                <dt>Developer</dt>
                <dd>API keys, webhooks, logs</dd>
                <dt>Viewer</dt>
                <dd>Read-only access</dd>
              </dl>
            </div>
            <SwitchCard
              title="Require 2FA"
              body="Members must set up two-factor authentication before they can sign in."
              checked={require2fa}
              onChange={setRequire2fa}
              label="Require 2FA"
            />
            <SwitchCard
              title="Changes to settlement addresses"
              body="Require a second Owner or Admin to approve address changes."
              checked={addressApproval}
              onChange={setAddressApproval}
              label="Approval required"
            />
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '18px 20px' }}>
          <h3 style={{ marginTop: 0 }}>{tab}</h3>
          <p className="muted" style={{ marginBottom: 0 }}>
            {tab === 'Settlement addresses'
              ? 'Settlement addresses are wallets you control. This preview does not store an address, a balance, or a payout.'
              : 'Example settings only. Nothing on this tab is saved.'}
          </p>
        </div>
      )}
      {note ? (
        <p className="muted" style={{ marginTop: 12 }}>
          {note}
        </p>
      ) : null}
    </>
  );
}

function SwitchCard({
  title,
  body,
  checked,
  onChange,
  label,
}: {
  title: string;
  body: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div className="row between">
        <h3>{title}</h3>
        <button
          type="button"
          className={`switch${checked ? '' : ' off'}`}
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
        />
      </div>
      <p className="muted" style={{ fontSize: 13, margin: '6px 0 0' }}>
        {body}
      </p>
    </div>
  );
}
