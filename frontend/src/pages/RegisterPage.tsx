import { Navigate } from 'react-router';
import RegisterForm from '../features/auth/components/RegisterForm.tsx';
import { useSession } from '../features/auth/session.ts';

export default function RegisterPage() {
  if (useSession()) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="page-title">Inscription</h1>
      <RegisterForm />
    </div>
  );
}
