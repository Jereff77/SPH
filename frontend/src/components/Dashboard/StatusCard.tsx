interface StatusCardProps {
  title: string;
  value: string | boolean | number;
  icon?: React.ReactNode;
  type?: 'success' | 'warning' | 'error' | 'default';
}

export function StatusCard({ title, value, icon, type = 'default' }: StatusCardProps) {
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-success-500/10 border-success-500/30 text-success-500';
      case 'warning':
        return 'bg-warning-500/10 border-warning-500/30 text-warning-500';
      case 'error':
        return 'bg-error-500/10 border-error-500/30 text-error-500';
      default:
        return 'bg-slate-700/50 border-slate-600 text-slate-300';
    }
  };

  const formatValue = (val: string | boolean | number): string => {
    if (typeof val === 'boolean') {
      return val ? 'Sí' : 'No';
    }
    if (typeof val === 'number') {
      return val.toLocaleString();
    }
    return val;
  };

  return (
    <div className={`${getTypeStyles()} rounded-lg border p-4 transition-all duration-200`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium opacity-80 mb-1">{title}</p>
          <p className="text-2xl font-bold">{formatValue(value)}</p>
        </div>
        {icon && (
          <div className="ml-4 text-3xl opacity-70">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
