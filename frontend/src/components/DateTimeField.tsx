import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  TIMES,
  dayKey,
  formatDisplay,
  monthGrid,
  parseDisplay,
  parseValue,
  toValue,
} from './dateTime.ts';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const monthName = (y: number, m: number) =>
  new Date(y, m - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
const dayLabel = (key: string) =>
  new Date(`${key}T12:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/**
 * Date and time of a form: a typed `jj/mm/aaaa hh:mm` field with a calendar and a list of times.
 * The value stays `YYYY-MM-DDTHH:mm` (local time), like a datetime-local input.
 */
export default function DateTimeField({
  label,
  value,
  onChange,
  min,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Earliest value: earlier days and times are disabled. */
  min?: string;
  required?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  // What is being typed, until the field loses the focus
  const [draft, setDraft] = useState<string | null>(null);
  const parts = parseValue(value);
  const floor = parseValue(min ?? '');
  const today = new Date();
  const start = parts ?? floor;
  const [view, setView] = useState({
    y: start?.y ?? today.getFullYear(),
    m: start?.m ?? today.getMonth() + 1,
  });
  // Day that takes the arrow keys inside the grid
  const [cursor, setCursor] = useState<string | null>(null);
  const moved = useRef(false);

  const selectedDay = parts ? dayKey(parts.y, parts.m, parts.d) : null;
  const floorDay = floor ? dayKey(floor.y, floor.m, floor.d) : null;
  const todayKey = dayKey(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  );
  const selectedTime = parts
    ? `${String(parts.h).padStart(2, '0')}:${String(parts.min).padStart(2, '0')}`
    : null;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Brings the chosen time into view when the list opens
  useEffect(() => {
    if (open) {
      root.current
        ?.querySelector('[role="option"][aria-selected="true"]')
        ?.scrollIntoView?.({ block: 'center' });
    }
  }, [open]);

  // Follows the arrow keys from day to day
  useEffect(() => {
    if (open && moved.current && cursor) {
      moved.current = false;
      root.current
        ?.querySelector<HTMLElement>(`[data-day="${cursor}"]`)
        ?.focus();
    }
  }, [open, cursor, view]);

  function openPicker() {
    const base = parts ?? floor;
    if (base) setView({ y: base.y, m: base.m });
    setCursor(selectedDay ?? floorDay ?? todayKey);
    setOpen(true);
  }

  // Never below the minimum
  const clamp = (result: string) =>
    min && parseValue(min) && result < min ? min : result;

  function emit(next: {
    y: number;
    m: number;
    d: number;
    h: number;
    min: number;
  }) {
    onChange(clamp(toValue(next)));
    setDraft(null);
  }

  function pickDay(key: string) {
    const [y, m, d] = key.split('-').map(Number);
    emit({ y, m, d, h: parts?.h ?? 9, min: parts?.min ?? 0 });
  }

  function pickTime(time: string) {
    const [h, min] = time.split(':').map(Number);
    const base = parts ??
      floor ?? {
        y: today.getFullYear(),
        m: today.getMonth() + 1,
        d: today.getDate(),
      };
    emit({ y: base.y, m: base.m, d: base.d, h, min });
  }

  function shiftMonth(delta: number) {
    const date = new Date(view.y, view.m - 1 + delta, 1);
    setView({ y: date.getFullYear(), m: date.getMonth() + 1 });
  }

  function onGridKeyDown(event: KeyboardEvent) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[
      event.key
    ];
    if (step === undefined || !cursor) return;
    event.preventDefault();
    const date = new Date(`${cursor}T12:00`);
    date.setDate(date.getDate() + step);
    moved.current = true;
    setCursor(dayKey(date.getFullYear(), date.getMonth() + 1, date.getDate()));
    setView({ y: date.getFullYear(), m: date.getMonth() + 1 });
  }

  function onListKeyDown(event: KeyboardEvent) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const options = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        '[role="option"]:not(:disabled)',
      ),
    );
    const at = options.indexOf(document.activeElement as HTMLElement);
    options[at + (event.key === 'ArrowDown' ? 1 : -1)]?.focus();
  }

  const text = draft ?? formatDisplay(value);
  const invalid = draft !== null && draft.trim() !== '' && !parseDisplay(draft);
  // A text that is not a date must stop the submit: the parent still holds the previous value
  useEffect(() => {
    input.current?.setCustomValidity(
      invalid ? 'Saisissez une date valide : jj/mm/aaaa hh:mm' : '',
    );
  }, [invalid]);
  const gridCursor =
    cursor && monthGrid(view.y, view.m).some(({ key }) => key === cursor)
      ? cursor
      : (selectedDay ?? `${dayKey(view.y, view.m, 1)}`);

  return (
    <div
      ref={root}
      className="relative space-y-1.5"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.stopPropagation();
          setOpen(false);
          input.current?.focus();
        }
      }}
    >
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          ref={input}
          id={id}
          type="text"
          autoComplete="off"
          placeholder="jj/mm/aaaa hh:mm"
          required={required}
          aria-invalid={invalid || undefined}
          value={text}
          onChange={(event) => {
            setDraft(event.target.value);
            const parsed = parseDisplay(event.target.value);
            if (parsed) onChange(clamp(parsed));
          }}
          onBlur={() => {
            if (draft !== null && draft.trim() === '') onChange('');
            setDraft(null);
          }}
          className="field pr-12"
        />
        <button
          type="button"
          aria-label={`Choisir la date et l'heure : ${label.toLowerCase()}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => (open ? setOpen(false) : openPicker())}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-muted hover:text-brand"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="3" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </button>
      </div>
      {open && (
        <div
          role="dialog"
          aria-label={`Date et heure : ${label.toLowerCase()}`}
          className="modal-panel z-40 w-[min(23rem,calc(100vw-1.5rem))] rounded-xl border border-line bg-white p-3 shadow-xl max-sm:fixed max-sm:inset-x-3 max-sm:bottom-3 max-sm:w-auto sm:absolute sm:top-full sm:right-0 sm:mt-2"
        >
          <div className="flex gap-3">
            <div className="w-[15.75rem] shrink-0">
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Mois précédent"
                  onClick={() => shiftMonth(-1)}
                  className="btn btn-sm size-9 min-h-0 px-0 hover:bg-canvas"
                >
                  ‹
                </button>
                <p aria-live="polite" className="font-semibold capitalize">
                  {monthName(view.y, view.m)}
                </p>
                <button
                  type="button"
                  aria-label="Mois suivant"
                  onClick={() => shiftMonth(1)}
                  className="btn btn-sm size-9 min-h-0 px-0 hover:bg-canvas"
                >
                  ›
                </button>
              </div>
              <div className="grid grid-cols-7 text-center text-xs text-muted">
                {WEEKDAYS.map((day, i) => (
                  <span key={i} aria-hidden="true" className="py-1">
                    {day}
                  </span>
                ))}
              </div>
              <div
                role="grid"
                aria-label={monthName(view.y, view.m)}
                onKeyDown={onGridKeyDown}
                className="grid grid-cols-7"
              >
                {monthGrid(view.y, view.m).map(({ key, day, inMonth }) => {
                  const disabled = !!floorDay && key < floorDay;
                  const selected = key === selectedDay;
                  return (
                    <button
                      key={key}
                      type="button"
                      data-day={key}
                      disabled={disabled}
                      aria-label={dayLabel(key)}
                      aria-pressed={selected}
                      tabIndex={key === gridCursor ? 0 : -1}
                      onClick={() => pickDay(key)}
                      className={`m-px size-9 rounded-full text-sm disabled:cursor-not-allowed disabled:text-field ${
                        selected
                          ? 'bg-brand font-semibold text-white'
                          : inMonth
                            ? 'hover:bg-brand-tint'
                            : 'text-muted/60 hover:bg-brand-tint'
                      } ${key === todayKey && !selected ? 'ring-1 ring-brand-edge' : ''}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
            <div
              role="listbox"
              aria-label="Heure"
              onKeyDown={onListKeyDown}
              className="max-h-[17.5rem] min-w-0 flex-1 space-y-0.5 overflow-y-auto"
            >
              {TIMES.map((time) => {
                const tooEarly =
                  !!floor &&
                  !!selectedDay &&
                  selectedDay === floorDay &&
                  time <
                    `${String(floor.h).padStart(2, '0')}:${String(floor.min).padStart(2, '0')}`;
                const selected = time === selectedTime;
                return (
                  <button
                    key={time}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={tooEarly}
                    tabIndex={
                      selected || (!selectedTime && time === '09:00') ? 0 : -1
                    }
                    onClick={() => pickTime(time)}
                    className={`block w-full rounded-md px-2 py-1.5 text-center text-sm tabular-nums disabled:text-field ${
                      selected
                        ? 'bg-brand font-semibold text-white'
                        : 'hover:bg-brand-tint'
                    }`}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                input.current?.focus();
              }}
              className="btn btn-primary btn-sm"
            >
              Valider
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
