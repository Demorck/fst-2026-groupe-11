import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';
import TextField from '../../../components/TextField.tsx';
import { useSubmit } from '../../auth/hooks/useSubmit.ts';
import { getOrganization, inviteMember, uploadLogo } from '../api.ts';
import { translate } from '../messages.ts';
import { ROLE_LABELS, STATUS_LABELS } from '../types.ts';
import type { OrganizationDetail } from '../types.ts';
import OrganizationLogo from './OrganizationLogo.tsx';

const LOGO_MAX_BYTES = 512 * 1024;

function InviteForm({
  organizationId,
  onInvited,
}: {
  organizationId: string;
  onInvited: () => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const { submit, pending, error } = useSubmit(async () => {
    setSent(null);
    await inviteMember(organizationId, email.trim());
    setSent(email.trim());
    setEmail('');
    await onInvited();
  });

  function onSubmit(event: SyntheticEvent) {
    event.preventDefault();
    void submit();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-3">
      <h2 className="text-xl font-semibold">Inviter</h2>
      <p className="text-sm text-gray-600">
        La personne doit avoir un compte bénévole ou organisateur et accepter
        l'invitation.
      </p>
      <TextField
        label="E-mail"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-red-600">
          {translate(error)}
        </p>
      )}
      {sent && (
        <p role="status" className="text-green-700">
          Invitation envoyée à {sent}.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
      >
        {pending ? 'Envoi...' : 'Inviter'}
      </button>
    </form>
  );
}

/** One organization: logo, members and, for its managers, the logo upload and the invitation form. */
export default function OrganizationDetailView({
  organizationId,
}: {
  organizationId: string;
}) {
  const [organization, setOrganization] = useState<OrganizationDetail | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      getOrganization(organizationId)
        .then(setOrganization)
        .catch((err: Error) => setError(translate(err.message))),
    [organizationId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function onLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLogoError(null);
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError('Le logo ne doit pas dépasser 512 Ko.');
      return;
    }
    try {
      await uploadLogo(organizationId, file);
      await load();
    } catch (err) {
      setLogoError(translate((err as Error).message));
    }
  }

  if (error) {
    return (
      <p role="alert" className="text-red-600">
        {error}
      </p>
    );
  }
  if (!organization) return <p>Chargement...</p>;

  const manager = organization.role === 'MANAGER';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-5">
        <OrganizationLogo
          organization={organization}
          className="size-24 text-3xl"
        />
        <div className="space-y-1">
          <h1 className="text-4xl font-bold">{organization.name}</h1>
          {organization.description && (
            <p className="text-gray-600">{organization.description}</p>
          )}
          <p className="text-sm text-gray-600">
            Votre rôle : {ROLE_LABELS[organization.role].toLowerCase()}
          </p>
        </div>
      </div>

      {manager && (
        <section className="max-w-xl space-y-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">
              Logo (PNG, JPEG ou WebP, 512 Ko maximum)
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => void onLogo(e)}
              className="block w-full text-sm"
            />
          </label>
          {logoError && (
            <p role="alert" className="text-red-600">
              {logoError}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="members" className="space-y-3">
        <h2 id="members" className="text-xl font-semibold">
          Membres
        </h2>
        <ul className="space-y-2">
          {organization.members.map(({ id, role, status, user }) => (
            <li
              key={id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
            >
              <span className="flex-1">
                <span className="font-medium">{user.name}</span>
                {user.email && (
                  <span className="ml-2 text-sm text-gray-600">
                    {user.email}
                  </span>
                )}
              </span>
              <span className="text-sm">{ROLE_LABELS[role]}</span>
              {status !== 'ACCEPTED' && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  {STATUS_LABELS[status]}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {manager && (
        <InviteForm organizationId={organizationId} onInvited={load} />
      )}
    </div>
  );
}
