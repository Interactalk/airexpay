import { Button } from '@airexpay/ui';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-5 py-20 text-center">
      <h1 className="font-serif text-4xl">Page not found</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        That route is not part of this simulation shell.
      </p>
      <Button className="mt-6" asChild>
        <Link to="/">Back to overview</Link>
      </Button>
    </div>
  );
}
