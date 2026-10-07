import { useCallback, useEffect, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import TextField from '../../../components/TextField.tsx';
import { useSubmit } from '../../auth/hooks/useSubmit.ts';
import { useAuth } from '../../auth/useAuth.ts';
import {
  answerInvitation,
  createOrganization,
  getInvitations,
  getMyOrganizations,
} from '../api.ts';
import { translate } from '../messages.ts';
import { ROLE_LABELS } from '../types.ts';
import type { Invitation, MyOrganization } from '../types.ts';
import OrganizationLogo from './OrganizationLogo.tsx';

const buttonClass =
  'rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60';

function CreateOrganizationForm() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { submit, pending, error } = useSubmit(async () => {
    const organization = await createOrganization({
      name: name.trim(),
      description: description.trim() || undefined,
    });
    await navigate(`/organizations/${organization.id}`);
  });

  function onSubmit(event: SyntheticEvent) {
    event.preventDefault();
    void submit();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-xl space-y-4 rounded-xl border border-gray-200 bg-white p-6"
    >
      <h2 className="text-xl font-semibold">Créer une organisation</h2>
      <TextField
        label="Nom"
        required
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextField
        label="Description (facultatif)"
        maxLength={500}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-red-600">
          {translate(error)}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={`${buttonClass} bg-indigo-600 text-white`}
      >
        {pending ? 'Création...' : "Créer l'organisation"}
      </button>
    </form>
  );
}

/** Invitations to answer, organizations I belong to and, for an organizer, the creation form. */
export default function OrganizationsOverview() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<MyOrganization[] | null>(
    null,
  );
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      Promise.all([getMyOrganizations(), getInvitations()])
        .then(([mine, pending]) => {
          setOrganizations(mine);
          setInvitations(pending);
        })
        .catch((err: Error) => setError(translate(err.message))),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function answer(id: string, choice: 'accept' | 'decline') {
    setError(null);
    try {
      await answerInvitation(id, choice);
      await load();
    } catch (err) {
      setError(translate((err as Error).message));
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}

      {invitations.length > 0 && (
        <section aria-labelledby="invitations" className="space-y-3">
          <h2 id="invitations" className="text-xl font-semibold">
            Invitations
          </h2>
          <ul className="space-y-2">
            {invitations.map(({ id, role, organization }) => (
              <li
                key={id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4"
              >
                <OrganizationLogo organization={organization} />
                <span className="flex-1">
                  <strong>{organization.name}</strong> vous invite comme{' '}
                  {ROLE_LABELS[role].toLowerCase()}.
                </span>
                <button
                  type="button"
                  onClick={() => void answer(id, 'accept')}
                  aria-label={`Accepter l'invitation de ${organization.name}`}
                  className={`${buttonClass} bg-indigo-600 text-white`}
                >
                  Accepter
                </button>
                <button
                  type="button"
                  onClick={() => void answer(id, 'decline')}
                  aria-label={`Refuser l'invitation de ${organization.name}`}
                  className={`${buttonClass} border border-gray-300 bg-white`}
                >
                  Refuser
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="mine" className="space-y-3">
        <h2 id="mine" className="text-xl font-semibold">
          Mes organisations
        </h2>
        {!organizations && !error && <p>Chargement...</p>}
        {organizations?.length === 0 && (
          <p>Vous n'appartenez à aucune organisation pour l'instant.</p>
        )}
        <ul className="space-y-2">
          {organizations?.map((organization) => (
            <li
              key={organization.id}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4"
            >
              <OrganizationLogo
                organization={organization}
                className="size-10 text-sm"
              />
              <Link
                to={`/organizations/${organization.id}`}
                className="flex-1 font-semibold text-indigo-700 hover:underline"
              >
                {organization.name}
              </Link>
              <span className="text-sm text-gray-600">
                {ROLE_LABELS[organization.role]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {user?.role === 'ORGANIZER' && <CreateOrganizationForm />}
    </div>
  );
}
