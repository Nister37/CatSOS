import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="panel" aria-labelledby="not-found-heading">
      <h2 id="not-found-heading">Page not found</h2>
      <p>The requested page does not exist.</p>
      <Link to="/">Return to dashboard</Link>
    </section>
  );
}
