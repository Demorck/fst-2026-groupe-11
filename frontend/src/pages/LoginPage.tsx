import { Navigate } from 'react-router';
import LoginForm from '../features/auth/components/LoginForm.tsx';
import { useSession } from '../features/auth/session.ts';

export default function LoginPage() {
  if (useSession()) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Connexion</h1>
      <LoginForm />
    </div>
  );
}
