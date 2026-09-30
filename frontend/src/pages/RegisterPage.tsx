import { Navigate } from 'react-router';
import RegisterForm from '../features/auth/components/RegisterForm.tsx';
import { useSession } from '../features/auth/session.ts';

export default function RegisterPage() {
  if (useSession()) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Inscription</h1>
      <RegisterForm />
    </div>
  );
}
