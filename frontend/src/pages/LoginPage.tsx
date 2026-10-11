import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import { Navigate } from 'react-router';
import AuthShell from '../features/auth/components/AuthShell.tsx';
import LoginForm from '../features/auth/components/LoginForm.tsx';
import { useSession } from '../features/auth/session.ts';

export default function LoginPage() {
  useDocumentTitle('Connexion');
  if (useSession()) return <Navigate to="/" replace />;

  return (
    <AuthShell
      title="Connexion"
      subtitle="Retrouvez vos billets, vos créneaux et vos organisations."
    >
      <LoginForm />
    </AuthShell>
  );
}
