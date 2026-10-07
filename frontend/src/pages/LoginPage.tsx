import { Navigate } from 'react-router';
import LoginForm from '../features/auth/components/LoginForm.tsx';
import { useSession } from '../features/auth/session.ts';

export default function LoginPage() {
  if (useSession()) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="page-title">Connexion</h1>
      <LoginForm />
    </div>
  );
}
