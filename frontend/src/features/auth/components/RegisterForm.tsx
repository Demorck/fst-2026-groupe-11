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
    <form onSubmit={onSubmit} className="card space-y-5 p-6">
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
      <label className="field-label">
        <span>Rôle</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="field"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
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
        {pending ? 'Inscription...' : "S'inscrire"}
      </button>
      <p className="text-center text-sm text-muted">
        Déjà un compte ?{' '}
        <Link to="/login" className="font-semibold">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
