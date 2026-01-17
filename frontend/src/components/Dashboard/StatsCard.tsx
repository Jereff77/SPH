interface StatsCardProps {
  title: string;
  value: number;
  unit?: string;
  color?: 'blue' | 'green' | 'amber' | 'red';
}

export function StatsCard({ title, value, unit = '', color = 'blue' }: StatsCardProps) {
  const colorClasses = {
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 hover:border-slate-600 transition-colors duration-200">
      <p className="text-sm font-medium text-slate-400 mb-1">{title}</p>
      <div className="flex items-baseline gap-2">
        <p className={`text-3xl font-bold ${colorClasses[color]}`}>
          {value.toLocaleString()}
        </p>
        {unit && (
          <p className="text-sm text-slate-500">{unit}</p>
        )}
      </div>
    </div>
  );
}
