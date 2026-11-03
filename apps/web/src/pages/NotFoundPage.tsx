import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="mkt">
      <header>
        <div className="mkt-bar">
          <Link to="/" className="brand" style={{ padding: 0 }}>
            Airex<span>pay</span>
          </Link>
        </div>
      </header>
      <main className="w" style={{ paddingTop: 72, paddingBottom: 80 }}>
        <h1 style={{ fontSize: 40 }}>Page not found</h1>
        <p className="muted">That route is not part of this preview.</p>
        <Link className="btn btn-primary" to="/">
          Back to home
        </Link>
      </main>
    </div>
  );
}
