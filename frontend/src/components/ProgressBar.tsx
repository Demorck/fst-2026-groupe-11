/** Fill gauge; `label` names what is measured for screen readers. */
export default function ProgressBar({
  value,
  max,
  label,
  className = '',
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`progress ${className}`}
    >
      <div className="progress-bar" style={{ width: `${percent}%` }} />
    </div>
  );
}
