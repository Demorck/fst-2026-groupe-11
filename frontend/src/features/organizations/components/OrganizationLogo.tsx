import { logoUrl } from '../types.ts';
import type { OrganizationSummary } from '../types.ts';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

// Same name, same color, so an organization without logo is still recognizable
const hue = (name: string) =>
  [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;

/** Round logo of an organization, or its initials on a colored disc when it has none. */
export default function OrganizationLogo({
  organization,
  className = 'size-8 text-xs',
}: {
  organization: OrganizationSummary;
  className?: string;
}) {
  const base = `inline-flex shrink-0 items-center justify-center rounded-full border-2 border-white font-semibold ${className}`;
  if (organization.hasLogo) {
    return (
      <img
        src={logoUrl(organization)}
        alt=""
        className={`${base} bg-white object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${base} text-white`}
      style={{ backgroundColor: `hsl(${hue(organization.name)} 55% 40%)` }}
    >
      {initials(organization.name)}
    </span>
  );
}
