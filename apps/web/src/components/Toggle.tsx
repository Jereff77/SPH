/** Interruptor (switch) reutilizable. variant "status" usa rojo cuando está apagado. */
export function Toggle({
  checked,
  onChange,
  disabled = false,
  variant = 'default',
  title,
}: {
  checked: boolean;
  onChange: (valor: boolean) => void;
  disabled?: boolean;
  variant?: 'default' | 'status';
  title?: string;
}) {
  const offBg = variant === 'status' ? 'bg-red-400' : 'bg-gray-300';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
        checked ? 'bg-green-500' : offBg
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition ${
          checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  );
}
