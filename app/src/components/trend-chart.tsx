import type { TrendPoint } from '@/lib/db/history';
import { formatDuration } from '@/lib/rank';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Day-by-hour heatmap of average wait.
 *
 * Rendered as plain SVG with no charting dependency: it ships less JavaScript,
 * works in an RSC without hydration, and renders identically offline. Colour is
 * always paired with a text value in the tooltip, so the chart is not
 * colour-dependent for meaning.
 */
export function TrendHeatmap({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) return null;

  const byKey = new Map(points.map((p) => [`${p.dayOfWeek}-${p.hour}`, p]));
  const values = points.map((p) => p.averageMinutes);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  const cell = 15;
  const gap = 2;
  const labelWidth = 30;
  const labelHeight = 16;
  const width = labelWidth + 24 * (cell + gap);
  const height = labelHeight + 7 * (cell + gap);

  return (
    <figure className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label="Average wait time by day of week and hour of day"
        className="max-w-full"
      >
        {[0, 3, 6, 9, 12, 15, 18, 21].map((hour) => (
          <text
            key={hour}
            x={labelWidth + hour * (cell + gap)}
            y={11}
            fontSize="9"
            fill="currentColor"
            opacity="0.6"
          >
            {hour === 0 ? '12a' : hour === 12 ? '12p' : hour > 12 ? `${hour - 12}p` : `${hour}a`}
          </text>
        ))}

        {DAY_LABELS.map((label, day) => (
          <text
            key={label}
            x={0}
            y={labelHeight + day * (cell + gap) + cell * 0.75}
            fontSize="9"
            fill="currentColor"
            opacity="0.6"
          >
            {label}
          </text>
        ))}

        {Array.from({ length: 7 }, (_, day) =>
          Array.from({ length: 24 }, (_, hour) => {
            const point = byKey.get(`${day}-${hour}`);
            const x = labelWidth + hour * (cell + gap);
            const y = labelHeight + day * (cell + gap);

            if (!point) {
              return (
                <rect
                  key={`${day}-${hour}`}
                  x={x}
                  y={y}
                  width={cell}
                  height={cell}
                  rx="2"
                  fill="currentColor"
                  opacity="0.06"
                />
              );
            }

            const t = (point.averageMinutes - min) / range;
            // Green through amber to red as waits climb.
            const hue = 140 - t * 140;

            return (
              <rect
                key={`${day}-${hour}`}
                x={x}
                y={y}
                width={cell}
                height={cell}
                rx="2"
                fill={`hsl(${hue} 62% ${45 + (1 - t) * 8}%)`}
              >
                <title>
                  {DAY_LABELS[day]} {hour}:00 — average {formatDuration(point.averageMinutes)} (
                  {point.sampleCount} readings)
                </title>
              </rect>
            );
          }),
        )}
      </svg>

      <figcaption className="mt-2 flex items-center gap-2 text-xs text-muted">
        <span>Shorter</span>
        <span
          aria-hidden
          className="h-2 w-20 rounded-full"
          style={{ background: 'linear-gradient(90deg, hsl(140 62% 53%), hsl(70 62% 49%), hsl(0 62% 45%))' }}
        />
        <span>Longer</span>
        <span className="ml-2">
          Average posted wait, {formatDuration(min)}–{formatDuration(max)}
        </span>
      </figcaption>
    </figure>
  );
}

/** Simple line of recent readings, for "what has today looked like". */
export function RecentSparkline({
  points,
}: {
  points: { capturedAt: string; waitMinutes: number | null }[];
}) {
  const usable = points.filter((p) => p.waitMinutes != null);
  if (usable.length < 3) return null;

  const width = 640;
  const height = 120;
  const pad = 8;

  const values = usable.map((p) => p.waitMinutes as number);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);

  const path = usable
    .map((p, i) => {
      const x = pad + (i / (usable.length - 1)) * (width - pad * 2);
      const y = height - pad - (((p.waitMinutes as number) - min) / range) * (height - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const first = new Date(usable[0].capturedAt);
  const last = new Date(usable[usable.length - 1].capturedAt);
  const timeFormat = new Intl.DateTimeFormat('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Edmonton',
  });

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`Wait time trend from ${timeFormat.format(first)} to ${timeFormat.format(last)}, ranging from ${formatDuration(min)} to ${formatDuration(max)}`}
      >
        <path
          d={`${path} L${width - pad},${height - pad} L${pad},${height - pad} Z`}
          fill="currentColor"
          opacity="0.08"
        />
        <path d={path} fill="none" stroke="var(--color-brand-500)" strokeWidth="2.5" />
      </svg>
      <figcaption className="flex justify-between text-xs text-muted">
        <span>{timeFormat.format(first)}</span>
        <span>
          Peak {formatDuration(max)} · Low {formatDuration(min)}
        </span>
        <span>{timeFormat.format(last)}</span>
      </figcaption>
    </figure>
  );
}
