import { Link, Navigate, Outlet } from 'react-router';
import { useSession } from '../session.ts';
import { hasRole, ROLE_LABELS, ROLES } from '../types.ts';
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

  if (roles && !roles.some((role) => hasRole(session.user.role, role))) {
    // `roles` are minimums: higher roles inherit them, so the message lists who really gets in
    const allowed = ROLES.filter((role) =>
      roles.some((minimum) => hasRole(role, minimum)),
    );
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 text-center">
        <h1 className="page-title">Accès refusé</h1>
        <p className="text-muted">
          Cette page est réservée au rôle{' '}
          {allowed.map((role) => ROLE_LABELS[role]).join(' ou ')}.
        </p>
        <Link to="/" className="btn btn-primary">
          Retour aux événements
        </Link>
      </div>
    );
  }

  return <Outlet />;
}
