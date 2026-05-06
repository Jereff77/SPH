'use client';

import React, { useState, useEffect } from 'react';
import { Widget } from '@/lib/reportes/studio-store';
import { useReportStudioStore } from '@/lib/reportes/studio-store';
import { getDistinctValues } from '@/lib/reportes/actions';

// ========== COMPONENTE ==========

interface FilterRendererProps {
  widget: Widget;
  width: number;
  height: number;
}

export function FilterRenderer({ widget, width, height }: FilterRendererProps) {
  const { activeFilters, addFilter, removeFilter } = useReportStudioStore();

  const campoVinculado = widget.filter_config?.campo_vinculado;

  // Si no hay campo vinculado, mostrar mensaje
  if (!campoVinculado) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#7a84a0',
          fontSize: 11,
          padding: 12,
          textAlign: 'center'
        }}
      >
        Configura el campo vinculado
      </div>
    );
  }

  // Renderizar según tipo de filtro
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: widget.mostrar_titulo ? '0 12px' : '12px',
        gap: 8
      }}
    >
      {widget.mostrar_titulo && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#7a84a0',
            whiteSpace: 'nowrap',
            flexShrink: 0
          }}
        >
          {widget.titulo}:
        </span>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {widget.tipo === 'filter_daterange' && (
          <DateRangeFilter
            campo={campoVinculado}
            activeFilters={activeFilters}
            onAddFilter={addFilter}
            onRemoveFilter={removeFilter}
          />
        )}
        {widget.tipo === 'filter_multiselect' && (
          <MultiSelectFilter
            widget={widget}
            campo={campoVinculado}
            activeFilters={activeFilters}
            onAddFilter={addFilter}
            onRemoveFilter={removeFilter}
          />
        )}
        {widget.tipo === 'filter_numericrange' && (
          <NumericRangeFilter
            campo={campoVinculado}
            activeFilters={activeFilters}
            onAddFilter={addFilter}
            onRemoveFilter={removeFilter}
          />
        )}
        {widget.tipo === 'filter_toggle' && (
          <ToggleFilter
            campo={campoVinculado}
            activeFilters={activeFilters}
            onAddFilter={addFilter}
            onRemoveFilter={removeFilter}
          />
        )}
        {widget.tipo === 'filter_dropdown' && (
          <DropdownFilter
            widget={widget}
            campo={campoVinculado}
            activeFilters={activeFilters}
            onAddFilter={addFilter}
            onRemoveFilter={removeFilter}
          />
        )}
      </div>
    </div>
  );
}

// ========== SUBCOMPONENTES ==========

interface FilterProps {
  campo: string;
  activeFilters: any[];
  onAddFilter: (filter: any) => void;
  onRemoveFilter: (campo: string) => void;
}

// --- Date Range Filter ---
function DateRangeFilter({ campo, activeFilters, onAddFilter, onRemoveFilter }: FilterProps) {
  const filtroActivo = activeFilters.find(f => f.campo === campo && f.operador === 'entre');

  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // Sincronizar con filtro activo (incluye hidratación del store)
  useEffect(() => {
    if (filtroActivo) {
      setFechaInicio(filtroActivo.valor || '');
      setFechaFin(filtroActivo.valor2 || '');
    } else {
      setFechaInicio('');
      setFechaFin('');
    }
  }, [filtroActivo?.valor, filtroActivo?.valor2]);

  const handleChange = (nuevoInicio: string, nuevoFin: string) => {
    if (!nuevoInicio && !nuevoFin) {
      onRemoveFilter(campo);
    } else {
      onAddFilter({
        campo,
        operador: 'entre',
        valor: nuevoInicio || null,
        valor2: nuevoFin || null
      });
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: '#f2f4f8',
        border: '1px solid #e2e6ef',
        borderRadius: 6,
        padding: '5px 10px',
        fontSize: 11,
        color: '#1b2d5e'
      }}
    >
      <input
        type="date"
        value={fechaInicio}
        onChange={(e) => {
          const val = e.target.value;
          setFechaInicio(val);
          handleChange(val, fechaFin);
        }}
        style={{
          border: 'none',
          background: 'transparent',
          fontSize: 11,
          color: '#1b2d5e',
          outline: 'none',
          padding: 0
        }}
      />
      <span style={{ color: '#7a84a0' }}>—</span>
      <input
        type="date"
        value={fechaFin}
        onChange={(e) => {
          const val = e.target.value;
          setFechaFin(val);
          handleChange(fechaInicio, val);
        }}
        style={{
          border: 'none',
          background: 'transparent',
          fontSize: 11,
          color: '#1b2d5e',
          outline: 'none',
          padding: 0
        }}
      />
    </div>
  );
}

// --- Multi Select Filter ---
interface MultiSelectFilterProps extends FilterProps {
  widget: Widget;
}

function MultiSelectFilter({ widget, campo, activeFilters, onAddFilter, onRemoveFilter }: MultiSelectFilterProps) {
  const filtroActivo = activeFilters.find(f => f.campo === campo && f.operador === 'en_lista');
  const seleccionados = filtroActivo?.valor || [];

  const [opciones, setOpciones] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fuente = widget.filter_config?.fuente || 'v_leads_completo';

  // Cargar opciones disponibles
  useEffect(() => {
    const loadOpciones = async () => {
      setIsLoading(true);
      try {
        const values = await getDistinctValues(fuente, campo);
        setOpciones(values);
      } catch (error) {
        console.error('Error cargando opciones:', error);
        setOpciones([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (campo) {
      loadOpciones();
    }
  }, [campo, fuente]);

  const toggleOpcion = (opcion: string) => {
    const nuevaSeleccion = seleccionados.includes(opcion)
      ? seleccionados.filter((s: string) => s !== opcion)
      : [...seleccionados, opcion];

    if (nuevaSeleccion.length === 0) {
      onRemoveFilter(campo);
    } else {
      onAddFilter({
        campo,
        operador: 'en_lista',
        valor: nuevaSeleccion
      });
    }
  };

  if (isLoading) {
    return (
      <div style={{ fontSize: 11, color: '#7a84a0' }}>
        Cargando opciones...
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flexWrap: 'wrap'
      }}
    >
      {opciones.map(opcion => (
        <span
          key={opcion}
          onClick={() => toggleOpcion(opcion)}
          style={{
            background: seleccionados.includes(opcion) ? '#1b2d5e' : '#f2f4f8',
            border: seleccionados.includes(opcion) ? '1px solid #1b2d5e' : '1px solid #e2e6ef',
            borderRadius: 4,
            padding: '3px 8px',
            fontSize: 10,
            color: seleccionados.includes(opcion) ? '#ffffff' : '#1b2d5e',
            fontWeight: 500,
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'all 0.2s'
          }}
        >
          {opcion}
          {seleccionados.includes(opcion) && (
            <span style={{ marginLeft: 4 }}>×</span>
          )}
        </span>
      ))}
    </div>
  );
}

// --- Numeric Range Filter ---
function NumericRangeFilter({ campo, activeFilters, onAddFilter, onRemoveFilter }: FilterProps) {
  const filtroActivo = activeFilters.find(f => f.campo === campo && f.operador === 'entre');

  const [min, setMin] = useState('');
  const [max, setMax] = useState('');

  // Sincronizar con filtro activo (incluye hidratación del store)
  useEffect(() => {
    if (filtroActivo) {
      setMin(String(filtroActivo.valor || ''));
      setMax(String(filtroActivo.valor2 || ''));
    } else {
      setMin('');
      setMax('');
    }
  }, [filtroActivo?.valor, filtroActivo?.valor2]);

  const handleChange = (nuevoMin: string, nuevoMax: string) => {
    if (!nuevoMin && !nuevoMax) {
      onRemoveFilter(campo);
    } else {
      onAddFilter({
        campo,
        operador: 'entre',
        valor: nuevoMin ? parseFloat(nuevoMin) : null,
        valor2: nuevoMax ? parseFloat(nuevoMax) : null
      });
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}
    >
      <input
        type="number"
        placeholder="Mín"
        value={min}
        onChange={(e) => {
          const val = e.target.value;
          setMin(val);
          handleChange(val, max);
        }}
        style={{
          flex: 1,
          padding: '4px 8px',
          border: '1px solid #e2e6ef',
          borderRadius: 4,
          fontSize: 11,
          color: '#1b2d5e',
          outline: 'none'
        }}
      />
      <span style={{ color: '#7a84a0' }}>—</span>
      <input
        type="number"
        placeholder="Máx"
        value={max}
        onChange={(e) => {
          const val = e.target.value;
          setMax(val);
          handleChange(min, val);
        }}
        style={{
          flex: 1,
          padding: '4px 8px',
          border: '1px solid #e2e6ef',
          borderRadius: 4,
          fontSize: 11,
          color: '#1b2d5e',
          outline: 'none'
        }}
      />
    </div>
  );
}

// --- Toggle Filter ---
function ToggleFilter({ campo, activeFilters, onAddFilter, onRemoveFilter }: FilterProps) {
  const filtroActivo = activeFilters.find(f => f.campo === campo && f.operador === 'igual');
  const isActive = filtroActivo?.valor === true;

  const handleToggle = () => {
    if (isActive) {
      onRemoveFilter(campo);
    } else {
      onAddFilter({
        campo,
        operador: 'igual',
        valor: true
      });
    }
  };

  return (
    <button
      onClick={handleToggle}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: isActive ? '#7dc244' : '#e2e6ef',
        border: 'none',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s'
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#ffffff',
          position: 'absolute',
          top: 2,
          left: isActive ? 18 : 2,
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }}
      />
    </button>
  );
}

// --- Dropdown Filter ---
interface DropdownFilterProps extends FilterProps {
  widget: Widget;
}

function DropdownFilter({ widget, campo, activeFilters, onAddFilter, onRemoveFilter }: DropdownFilterProps) {
  const filtroActivo = activeFilters.find(f => f.campo === campo && f.operador === 'igual');

  const [selectedValue, setSelectedValue] = useState('');

  // Sincronizar con filtro activo (incluye hidratación del store)
  useEffect(() => {
    setSelectedValue(filtroActivo?.valor || '');
  }, [filtroActivo?.valor]);

  const [opciones, setOpciones] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fuente = widget.filter_config?.fuente || 'v_leads_completo';

  // Cargar opciones disponibles
  useEffect(() => {
    const loadOpciones = async () => {
      setIsLoading(true);
      try {
        const values = await getDistinctValues(fuente, campo);
        setOpciones(values);
      } catch (error) {
        console.error('Error cargando opciones:', error);
        setOpciones([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (campo) {
      loadOpciones();
    }
  }, [campo, fuente]);

  const handleChange = (valor: string) => {
    setSelectedValue(valor);

    if (!valor || valor === '') {
      onRemoveFilter(campo);
    } else {
      onAddFilter({
        campo,
        operador: 'igual',
        valor
      });
    }
  };

  if (isLoading) {
    return (
      <div style={{ fontSize: 11, color: '#7a84a0' }}>
        Cargando...
      </div>
    );
  }

  return (
    <select
      value={selectedValue}
      onChange={(e) => handleChange(e.target.value)}
      style={{
        width: '100%',
        padding: '5px 8px',
        border: '1px solid #e2e6ef',
        borderRadius: 6,
        fontSize: 11,
        color: '#1b2d5e',
        background: '#f2f4f8',
        outline: 'none',
        cursor: 'pointer'
      }}
    >
      <option value="">Todos</option>
      {opciones.map(opcion => (
        <option key={opcion} value={opcion}>
          {opcion}
        </option>
      ))}
    </select>
  );
}
