import { useEffect, useRef, useState } from 'react';

/** ISO (yyyy-MM-dd) → dd/mm/aaaa para mostrar. */
const isoADmy = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

/** dd/mm/aaaa → ISO (yyyy-MM-dd); null si no es una fecha válida y completa. */
const dmyAIso = (dmy: string): string | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy);
  if (!m) return null;
  const d = +m[1]!;
  const mo = +m[2]!;
  const y = +m[3]!;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};

/**
 * Campo de captura de fecha en formato **dd/mm/aaaa** (regla de diseño del proyecto)
 * que **conserva el selector de calendario** nativo. Combina un input de texto con
 * máscara `dd/mm/aaaa` (auto-inserta las "/") y un botón de calendario que abre el
 * date picker del navegador. Internamente trabaja en **ISO** (`yyyy-MM-dd`): `value`
 * entra en ISO y `onChange` emite ISO (o '' si el campo queda incompleto/vacío).
 */
export function InputFecha({
  value,
  onChange,
  className = '',
  id,
  disabled = false,
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(isoADmy(value));
  const dateRef = useRef<HTMLInputElement>(null);

  // Resincroniza si el valor cambia desde afuera (p. ej. al limpiar el formulario).
  useEffect(() => {
    setText(isoADmy(value));
  }, [value]);

  function handleTexto(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 8); // ddmmyyyy
    let out = raw;
    if (raw.length > 4) out = `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4)}`;
    else if (raw.length > 2) out = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    setText(out);

    const iso = dmyAIso(out);
    if (iso) onChange(iso);
    else if (out === '') onChange('');
  }

  function abrirPicker() {
    if (disabled) return;
    const el = dateRef.current;
    if (!el) return;
    try {
      // showPicker() abre el calendario nativo (Chrome/Edge/Firefox modernos).
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        maxLength={10}
        value={text}
        disabled={disabled}
        onChange={handleTexto}
        className={`${className} pr-8`}
      />
      <button
        type="button"
        onClick={abrirPicker}
        disabled={disabled}
        aria-label="Abrir calendario"
        tabIndex={-1}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1f2a4d] disabled:opacity-50"
      >
        📅
      </button>
      {/* Input date real (oculto) que aporta el calendario nativo. */}
      <input
        ref={dateRef}
        type="date"
        value={value || ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-2 h-0 w-0 opacity-0"
      />
    </div>
  );
}
