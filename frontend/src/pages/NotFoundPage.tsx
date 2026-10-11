import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import { Link } from 'react-router';

export default function NotFoundPage() {
  useDocumentTitle('Page introuvable');
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <p
        aria-hidden="true"
        className="font-display text-7xl font-bold text-brand"
      >
        404
      </p>
      <h1 className="page-title">Page introuvable</h1>
      <p className="text-muted">Cette page n'existe pas ou a été déplacée.</p>
      <Link to="/" className="btn btn-primary">
        Retour aux événements
      </Link>
    </div>
  );
}
