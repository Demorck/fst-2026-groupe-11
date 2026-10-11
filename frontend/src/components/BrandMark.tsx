/** The notched ticket that G-Event wears everywhere: header, sign-in, tickets. */
export default function BrandMark({
  className = 'size-7',
}: {
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 28 28"
      className={className}
      fill="currentColor"
    >
      <path d="M6 5h16a3 3 0 0 1 3 3v3.5a2.5 2.5 0 0 0 0 5V20a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-3.5a2.5 2.5 0 0 0 0-5V8a3 3 0 0 1 3-3Z" />
    </svg>
  );
}
