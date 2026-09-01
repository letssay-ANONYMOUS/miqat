import { useState, type ReactNode } from 'react';
import { Field, Sheet, selectClass } from './Sheet';
import { METHOD_BY_KEY, METHODS, methodForPlace, type MethodKey } from '../lib/methods';
import { PRAYER_META, PRAYER_ORDER } from '../lib/prayer';
import { useStore } from '../lib/store';
import { Segmented } from './Segmented';
import { CLOCK_STYLES } from './Countdown';
import { DIAL_STYLES, Dial } from './Dial';
import { ClockFormatPreview, IqamaPreview, LayoutPreview, OffsetPreview } from './SettingPreview';
import { NotifySetting } from './NotifySetting';
import { PrivacySetting } from './PrivacySetting';

type Tab = 'display' | 'iqama' | 'calculation' | 'fine' | 'privacy';

const TABS: { id: Tab; label: string }[] = [
  { id: 'display', label: 'Display' },
  { id: 'iqama', label: 'Iqama' },
  { id: 'calculation', label: 'Method' },
  { id: 'fine', label: 'Fine tune' },
  { id: 'privacy', label: 'Privacy' },
];

export function SettingsContent() {
  const {
    settings,
    patchSettings,
    setOffset,
    setIqamaOffset,
    resetOffsets,
    pinMethod,
    methodPinned,
    place,
  } = useStore();
  const [tab, setTab] = useState<Tab>('display');
  const method = METHOD_BY_KEY.get(settings.method)!;
  const suggested = methodForPlace(place?.countryCode, place?.latitude, place?.longitude);
  const offsetsUsed = PRAYER_ORDER.some((k) => settings.offsets[k] !== 0);

  return (
    <>
      <div className="-mt-1 mb-5">
        <Segmented
          label="Settings section"
          value={tab}
          onChange={setTab}
          size="compact"
          fill={false}
          options={TABS.map((t) => ({ value: t.id, label: t.label }))}
        />
      </div>

      {tab === 'display' && (
        <div className="space-y-6">
          <div>
            <span className="text-[13px] font-medium text-[var(--ink-dim)]">Clock</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(['24h', '12h'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => patchSettings({ timeFormat: option })}
                  className={`flex flex-col items-center gap-1 rounded-xl border py-3 transition ${
                    settings.timeFormat === option
                      ? 'border-[var(--accent-soft)] bg-white/10'
                      : 'border-[var(--card-line)] active:bg-white/5'
                  }`}
                >
                  <ClockFormatPreview format={option} />
                  <span className="text-xs text-[var(--ink-dim)]">
                    {option === '24h' ? '24-hour' : '12-hour'}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-[13px] font-medium text-[var(--ink-dim)]">Clock face</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {CLOCK_STYLES.map((option) => (
                <button
                  key={option.value}
                  onClick={() => patchSettings({ clockStyle: option.value })}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    settings.clockStyle === option.value
                      ? 'border-[var(--accent-soft)] bg-white/10'
                      : 'border-[var(--card-line)] active:bg-white/5'
                  }`}
                >
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span
                    className={`tabular mt-1 block text-[var(--ink-dim)] clock-preview-${option.value}`}
                  >
                    {option.sample}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[13px] font-medium text-[var(--ink-dim)]">Dial</span>
            <p className="mt-1 text-xs text-[var(--ink-faint)]">
              The ring around the countdown, and how it moves.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {DIAL_STYLES.map((option) => (
                <button
                  key={option.value}
                  onClick={() => patchSettings({ dialStyle: option.value })}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${
                    settings.dialStyle === option.value
                      ? 'border-[var(--accent-soft)] bg-white/10'
                      : 'border-[var(--card-line)] active:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="relative block h-11 w-11 shrink-0">
                      <Dial style={option.value} progress={0.68} seconds={0.42} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-tight text-[var(--ink-faint)]">
                        {option.hint}
                      </span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-[13px] font-medium text-[var(--ink-dim)]">Prayer layout</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {([
                { value: 'list', label: 'List', hint: 'Stacked rows, with notes' },
                { value: 'grid', label: 'Grid', hint: 'Six tiles, three across' },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  onClick={() => patchSettings({ prayerLayout: option.value })}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${
                    settings.prayerLayout === option.value
                      ? 'border-[var(--accent-soft)] bg-white/10'
                      : 'border-[var(--card-line)] active:bg-white/5'
                  }`}
                >
                  <span className="flex flex-col items-center gap-2">
                    <LayoutPreview variant={option.value} />
                    <span className="text-sm font-medium">{option.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <NotifySetting />
          <Field label="Hijri adjustment" hint="Days, for local moon sighting.">
            <select
              className={selectClass}
              value={settings.hijriOffset}
              onChange={(e) => patchSettings({ hijriOffset: Number(e.target.value) })}
            >
              {[-2, -1, 0, 1, 2].map((d) => (
                <option key={d} value={d}>
                  {d > 0 ? `+${d}` : d} {Math.abs(d) === 1 ? 'day' : 'days'}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      {tab === 'iqama' && (
        <div className="space-y-6">
          <p className="text-xs leading-relaxed text-[var(--ink-faint)]">
            Minutes from the adhan to the congregation. Awqaf's standard across the UAE is 20
            minutes for Fajr, Dhuhr, Asr and Isha, and 5 for Maghrib — but mosques do vary, so set
            yours here. Switch the board between the two with the toggle at the top.
          </p>
          <div className="space-y-1.5">
            {PRAYER_ORDER.filter((k) => k !== 'sunrise').map((key) => (
              <div key={key} className="rounded-xl border border-[var(--card-line)] px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{PRAYER_META[key].en}</span>
                  <IqamaPreview minutes={settings.iqamaOffsets[key] ?? 0} />
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={45}
                    value={settings.iqamaOffsets[key] ?? 0}
                    onChange={(e) => setIqamaOffset(key, Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="tabular w-14 text-right text-sm text-[var(--ink-dim)]">
                    +{settings.iqamaOffsets[key] ?? 0} m
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Field
            label="Jumuʿah"
            hint="Friday replaces Dhuhr, and the time is fixed by the authority rather than by an offset. The UAE default is 12:45."
          >
            <input
              type="time"
              className={selectClass}
              value={settings.jumuahTime}
              onChange={(e) => patchSettings({ jumuahTime: e.target.value })}
            />
          </Field>
        </div>
      )}

      {tab === 'calculation' && (
        <div className="space-y-6">
          <Field
            label="Method"
            hint={`${method.summary} — used in ${method.region}.${
              !methodPinned && place ? ` Auto-selected for ${place.country || place.countryCode}.` : ''
            }`}
          >
            <select
              className={selectClass}
              value={settings.method}
              onChange={(e) => {
                patchSettings({ method: e.target.value as MethodKey });
                pinMethod(true);
              }}
            >
              {METHODS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          {methodPinned && place && suggested !== settings.method && (
            <button
              onClick={() => {
                patchSettings({ method: suggested });
                pinMethod(false);
              }}
              className="-mt-3 block text-xs text-[var(--accent)] underline underline-offset-4"
            >
              Use the method normally followed in {place.country || place.countryCode} (
              {METHOD_BY_KEY.get(suggested)!.label})
            </button>
          )}

          {settings.method === 'Custom' && (
            <div className="grid grid-cols-3 gap-3">
              <Field label="Fajr angle">
                <input
                  type="number"
                  step="0.1"
                  className={selectClass}
                  value={settings.customFajrAngle}
                  onChange={(e) => patchSettings({ customFajrAngle: Number(e.target.value) })}
                />
              </Field>
              <Field label="Isha angle">
                <input
                  type="number"
                  step="0.1"
                  className={selectClass}
                  value={settings.customIshaAngle}
                  onChange={(e) => patchSettings({ customIshaAngle: Number(e.target.value) })}
                />
              </Field>
              <Field label="Isha interval">
                <input
                  type="number"
                  className={selectClass}
                  value={settings.customIshaInterval}
                  onChange={(e) => patchSettings({ customIshaInterval: Number(e.target.value) })}
                />
              </Field>
            </div>
          )}

          <ChoiceCards
            label="Asr — juristic school"
            hint={
              settings.madhab === 'hanafi'
                ? 'Asr when a shadow is twice the object’s length.'
                : 'Asr when a shadow equals the object’s length.'
            }
            value={settings.madhab}
            options={[
              { value: 'shafi', label: 'Standard' },
              { value: 'hanafi', label: 'Hanafi' },
            ]}
            onChange={(madhab) => patchSettings({ madhab })}
          />

          <Field
            label="High latitude rule"
            hint="Only bites above roughly 48°, where twilight never fully ends in summer."
          >
            <select
              className={selectClass}
              value={settings.highLatitudeRule}
              onChange={(e) =>
                patchSettings({
                  highLatitudeRule: e.target.value as typeof settings.highLatitudeRule,
                })
              }
            >
              <option value="auto">Recommended for this location</option>
              <option value="middleofthenight">Middle of the night</option>
              <option value="seventhofthenight">One seventh of the night</option>
              <option value="twilightangle">Angle based</option>
            </select>
          </Field>

          {settings.method === 'MoonsightingCommittee' && (
            <Field label="Shafaq (Isha twilight)" hint="Only used by the Moonsighting Committee method.">
              <select
                className={selectClass}
                value={settings.shafaq}
                onChange={(e) => patchSettings({ shafaq: e.target.value as typeof settings.shafaq })}
              >
                <option value="general">General</option>
                <option value="ahmer">Ahmer — red twilight</option>
                <option value="abyad">Abyad — white twilight</option>
              </select>
            </Field>
          )}
        </div>
      )}

      {tab === 'privacy' && <PrivacySetting />}

      {tab === 'fine' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-medium text-[var(--ink-dim)]">
                Manual correction
              </span>
              {offsetsUsed && (
                <button
                  onClick={resetOffsets}
                  className="text-xs text-[var(--accent)] underline underline-offset-4"
                >
                  Clear all
                </button>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--ink-faint)]">
              If your mosque calls a few minutes off the calculation, nudge it here. This is the
              only way any app can match one specific mosque exactly.
            </p>
            <div className="mt-3 space-y-1.5">
              {PRAYER_ORDER.map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-16 text-sm">{PRAYER_META[key].en}</span>
                  <OffsetPreview minutes={settings.offsets[key]} />
                  <input
                    type="range"
                    min={-30}
                    max={30}
                    value={settings.offsets[key]}
                    onChange={(e) => setOffset(key, Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="tabular w-12 text-right text-sm text-[var(--ink-dim)]">
                    {settings.offsets[key] > 0 ? '+' : ''}
                    {settings.offsets[key]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--card-line)] p-4">
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-[13px] font-medium">Use my full height</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--ink-faint)]">
                  Sunrise and Maghrib already allow for the terrain where your convention's
                  authority accounts for it. Switch this on only if you are genuinely above the
                  land around you — on a mountain rather than on a plateau — and it will use your
                  full height above sea level instead.
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.useElevation}
                onChange={(e) => patchSettings({ useElevation: e.target.checked })}
                className="h-5 w-5 shrink-0 accent-[var(--accent)]"
              />
            </label>
            {settings.useElevation && (
              <div className="mt-4 flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={9000}
                  value={settings.elevation}
                  onChange={(e) => patchSettings({ elevation: Math.max(0, Number(e.target.value)) })}
                  className="w-28 rounded-xl border border-[var(--card-line)] bg-black/25 px-3 py-2 text-sm outline-none focus:border-[var(--accent-soft)]"
                />
                <span className="text-xs text-[var(--ink-dim)]">metres above sea level</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} title="Settings" onClose={onClose}>
      <SettingsContent />
    </Sheet>
  );
}

function ChoiceCards<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: ReactNode;
  value: T;
  options: { value: T; label: string; example?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <span className="text-[13px] font-medium text-[var(--ink-dim)]">{label}</span>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-xl border px-3 py-3 text-sm transition ${
              value === option.value
                ? 'border-[var(--accent-soft)] bg-white/10 text-[var(--ink)]'
                : 'border-[var(--card-line)] text-[var(--ink-dim)] active:bg-white/5'
            }`}
          >
            <span className="block font-medium">{option.label}</span>
            {option.example && (
              <span className="tabular mt-0.5 block text-xs text-[var(--ink-faint)]">
                {option.example}
              </span>
            )}
          </button>
        ))}
      </div>
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-faint)]">{hint}</p>}
    </div>
  );
}
