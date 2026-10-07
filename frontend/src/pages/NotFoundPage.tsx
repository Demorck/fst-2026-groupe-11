import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <div className="space-y-3">
      <h1 className="page-title">Page introuvable</h1>
      <Link to="/" className="font-semibold underline">
        Retour aux événements
      </Link>
    </div>
  );
}
