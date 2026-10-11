import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import TextField from '../../../components/TextField.tsx';
import { register } from '../api.ts';
import { useSubmit } from '../hooks/useSubmit.ts';
import { ROLES, ROLE_LABELS } from '../types.ts';
import type { Role } from '../types.ts';

const ROLE_HINTS: Record<Role, string> = {
  PARTICIPANT: 'Je réserve des places aux événements.',
  VOLUNTEER: "Je rejoins des organisations et m'inscris sur des créneaux.",
  ORGANIZER: 'Je crée des organisations et des événements.',
};

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
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
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
      </div>
      <TextField
        label="Mot de passe (8 caractères minimum)"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Rôle</legend>
        <div className="grid gap-2">
          {ROLES.map((r) => (
            <label
              key={r}
              className="flex min-h-11 cursor-pointer flex-col rounded-lg border border-field bg-white px-4 py-2.5 has-[:checked]:border-brand has-[:checked]:bg-brand-tint/60 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand"
            >
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
                className="sr-only"
              />
              <span className="font-semibold">{ROLE_LABELS[r]}</span>
              <span className="text-sm text-muted">{ROLE_HINTS[r]}</span>
            </label>
          ))}
        </div>
      </fieldset>
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
