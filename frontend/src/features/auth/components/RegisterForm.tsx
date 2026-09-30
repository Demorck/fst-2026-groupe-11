import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import TextField from '../../../components/TextField.tsx';
import { register } from '../api.ts';
import { useSubmit } from '../hooks/useSubmit.ts';
import { ROLES, ROLE_LABELS } from '../types.ts';
import type { Role } from '../types.ts';

export default function RegisterForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('PARTICIPANT');
  const { submit, pending, error } = useSubmit(async () => {
    await register({ email, name, password, role });
    await navigate('/login');
  });

  function onSubmit(event: SyntheticEvent) {
    event.preventDefault();
    void submit();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-4">
      <TextField
        label="Nom"
        autoComplete="name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <TextField
        label="Mot de passe (8 caractères minimum)"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <label className="block space-y-1">
        <span className="text-sm font-medium">Rôle</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="block w-full rounded border border-gray-300 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-indigo-600"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
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
        {pending ? 'Inscription...' : "S'inscrire"}
      </button>
      <p className="text-sm">
        Déjà un compte ?{' '}
        <Link to="/login" className="underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
