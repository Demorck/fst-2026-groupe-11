import QRCode from 'qrcode';

// Blank border of 4 modules around the code, required by the QR spec to be scannable
const QUIET_ZONE = 4;

/** QR code of a ticket code, drawn as SVG from the module matrix (display only, no camera scan). */
export default function TicketQrCode({
  code,
  className = 'h-40 w-40',
}: {
  code: string;
  className?: string;
}) {
  const { size, data } = QRCode.create(code).modules;
  const cells = Array.from(data, (dark, i) =>
    dark
      ? `M${(i % size) + QUIET_ZONE} ${Math.floor(i / size) + QUIET_ZONE}h1v1h-1z`
      : '',
  );
  const side = size + QUIET_ZONE * 2;

  return (
    <svg
      viewBox={`0 0 ${side} ${side}`}
      role="img"
      aria-label={`QR code du billet ${code}`}
      shapeRendering="crispEdges"
      className={`rounded border border-line bg-white ${className}`}
    >
      <path d={cells.join('')} fill="#000" />
    </svg>
  );
}
