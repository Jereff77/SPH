export interface TabDef {
  id: string;
  label: string;
  disabled?: boolean;
}

/** Pestañas simples (subrayado activo). */
export function Tabs({
  tabs,
  activo,
  onChange,
}: {
  tabs: TabDef[];
  activo: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          disabled={t.disabled}
          onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
            activo === t.id
              ? 'border-[#1f2a4d] text-[#1f2a4d]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
