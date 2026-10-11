import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import { Navigate } from 'react-router';
import AuthShell from '../features/auth/components/AuthShell.tsx';
import RegisterForm from '../features/auth/components/RegisterForm.tsx';
import { useSession } from '../features/auth/session.ts';

export default function RegisterPage() {
  useDocumentTitle('Inscription');
  if (useSession()) return <Navigate to="/" replace />;

  return (
    <AuthShell
      title="Inscription"
      subtitle="Créez votre compte pour réserver, bénévoler ou organiser."
    >
      <RegisterForm />
    </AuthShell>
  );
}
