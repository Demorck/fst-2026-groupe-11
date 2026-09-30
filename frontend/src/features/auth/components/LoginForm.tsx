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
    <form onSubmit={onSubmit} className="max-w-sm space-y-4">
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
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-indigo-600 px-4 py-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
      >
        {pending ? 'Connexion...' : 'Se connecter'}
      </button>
      <p className="text-sm">
        Pas encore de compte ?{' '}
        <Link to="/register" className="underline">
          S'inscrire
        </Link>
      </p>
    </form>
  );
}
