import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Link } from 'react-router';
import TextField from '../../../components/TextField.tsx';
import { useSubmit } from '../hooks/useSubmit.ts';
import { useAuth } from '../useAuth.ts';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  // LoginPage redirects home as soon as the session exists
  const { submit, pending, error } = useSubmit(() =>
    login({ email, password }),
  );

  function onSubmit(event: SyntheticEvent) {
    event.preventDefault();
    void submit();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextField
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary w-full"
      >
        {pending ? 'Connexion...' : 'Se connecter'}
      </button>
      <p className="text-center text-sm text-muted">
        Pas encore de compte ?{' '}
        <Link to="/register" className="font-semibold">
          S'inscrire
        </Link>
      </p>
    </form>
  );
}
