import { Link, Navigate, Outlet } from 'react-router';
import { useSession } from '../session.ts';
import { ROLE_LABELS } from '../types.ts';
import type { Role } from '../types.ts';

interface RequireAuthProps {
  /** Roles allowed to see the child routes. Any logged in user when omitted. */
  roles?: readonly Role[];
}

/**
 * Layout route that renders its child routes only for a logged in user with an allowed role.
 * Only hides the UI: the backend guards are what actually protect the data.
 */
export default function RequireAuth({ roles }: RequireAuthProps) {
  const session = useSession();

  if (!session) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(session.user.role)) {
    return (
      <div className="space-y-2">
        <h1 className="page-title">Accès refusé</h1>
        <p>
          Cette page est réservée au rôle{' '}
          {roles.map((role) => ROLE_LABELS[role]).join(' ou ')}.
        </p>
        <Link to="/" className="font-semibold underline">
          Retour aux événements
        </Link>
      </div>
    );
  }

  return <Outlet />;
}
