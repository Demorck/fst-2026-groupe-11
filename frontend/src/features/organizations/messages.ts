// The API answers in English, the interface speaks French
const MESSAGES: Record<string, string> = {
  'Organization name already used': 'Ce nom d’organisation est déjà utilisé.',
  'Invitation already answered': 'Cette invitation a déjà reçu une réponse.',
  'Invitation not found': 'Invitation introuvable.',
  'Not a manager of this organization':
    'Seuls les gestionnaires peuvent faire cela.',
  'Not a member of this organization':
    'Vous n’êtes pas membre de cette organisation.',
  'Organization not found': 'Organisation introuvable.',
  'Invitation expired': 'Cette invitation a expiré (7 jours).',
  'Last manager of the organization':
    'Vous êtes le dernier gestionnaire : nommez-en un autre avant de partir.',
  'The creator cannot leave while co-managers remain':
    'Retirez d’abord les co-gestionnaires avant de quitter l’organisation.',
  'Not a pending invitation': 'Cette invitation n’est plus en attente.',
  'Member not found': 'Membre introuvable.',
  'The creator cannot be removed':
    'Le créateur de l’organisation ne peut pas être retiré.',
  'Only the creator can remove a manager':
    'Seul le créateur peut retirer un gestionnaire.',
  'Use leave to quit an organization':
    'Pour partir, utilisez « Quitter l’organisation ».',
  'Logo must be a PNG, JPEG or WebP image':
    'Le logo doit être une image PNG, JPEG ou WebP.',
};

export const translate = (message: string) => MESSAGES[message] ?? message;
