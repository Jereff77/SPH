import { useState, useEffect } from 'react';
import { useApi } from '../../hooks';
import type { SystemConfig } from '../../types';

const DAYS_OF_WEEK = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

export function ConfigForm() {
  const { config, loading, updateConfig, fetchConfig } = useApi();
  const [formData, setFormData] = useState<Partial<SystemConfig>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);

    try {
      const result = await updateConfig(formData);
      if (result.success) {
        setSaveMessage({ type: 'success', text: 'Configuración guardada exitosamente' });
        await fetchConfig();
      } else {
        setSaveMessage({ type: 'error', text: result.error || 'Error al guardar la configuración' });
      }
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Error al guardar la configuración' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 5000);
    }
  };

  const handleChange = (field: keyof SystemConfig, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDayToggle = (dayIndex: number) => {
    const currentDays = formData.schedule_days || config?.schedule_days || [];
    const newDays = currentDays.includes(dayIndex)
      ? currentDays.filter((d) => d !== dayIndex)
      : [...currentDays, dayIndex].sort();

    handleChange('schedule_days', newDays);
  };

  if (loading.config) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="bg-error-500/10 border border-error-500 rounded-lg p-6">
        <p className="text-error-500 text-center">No se pudo cargar la configuración</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Polling Interval */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Intervalos de Sondeo</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Intervalo Activo (segundos)
            </label>
            <input
              type="number"
              min="10"
              max="3600"
              value={formData.polling_interval ?? config.polling_interval}
              onChange={(e) => handleChange('polling_interval', parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">
              Frecuencia de verificación en horario activo (mínimo 10s)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Intervalo Inactivo (segundos)
            </label>
            <input
              type="number"
              min="10"
              max="3600"
              value={formData.polling_interval_idle ?? config.polling_interval_idle}
              onChange={(e) => handleChange('polling_interval_idle', parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">
              Frecuencia fuera del horario configurado (mínimo 10s)
            </p>
          </div>
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Horario de Actividad</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.schedule_enabled ?? config.schedule_enabled}
              onChange={(e) => handleChange('schedule_enabled', e.target.checked)}
              className="w-5 h-5 rounded border-slate-600 text-primary-500 focus:ring-primary-500 focus:ring-offset-slate-800"
            />
            <span className="text-sm font-medium text-slate-300">
              Habilitar horario
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Hora de Inicio
            </label>
            <input
              type="time"
              value={formData.schedule_start_time ?? config.schedule_start_time}
              onChange={(e) => handleChange('schedule_start_time', e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Hora de Fin
            </label>
            <input
              type="time"
              value={formData.schedule_end_time ?? config.schedule_end_time}
              onChange={(e) => handleChange('schedule_end_time', e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Días Activos
          </label>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day, index) => {
              const isSelected = (formData.schedule_days || config.schedule_days).includes(index);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDayToggle(index)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                    isSelected
                      ? 'bg-primary-500 text-white hover:bg-primary-600'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {day.substring(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div
          className={`rounded-lg p-4 ${
            saveMessage.type === 'success'
              ? 'bg-success-500/10 border border-success-500 text-success-500'
              : 'bg-error-500/10 border border-error-500 text-error-500'
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-slate-800"
        >
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>
    </form>
  );
}
