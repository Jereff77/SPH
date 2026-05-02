'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { WidgetData } from '@/lib/reportes/types';

// ========== PALETA DE COLORES SPH ==========

const CHART_COLORS = [
  '#7dc244', // verde (primary)
  '#1b2d5e', // navy
  '#3b82f6', // blue
  '#f59e0b', // orange
  '#e85d4a', // red
  '#8b5cf6'  // purple
];

// ========== COMPONENTE ==========

interface ChartRendererProps {
  widget: any;
  data?: WidgetData;  // Opcional en Fase 2 - se conectará a datos reales en fases posteriores
  width: number;
  height: number;
}

export function ChartRenderer({ widget, data, width, height }: ChartRendererProps) {
  const innerHeight = height;
  const innerWidth = width - 16;

  // Fase 2: Si no hay datos, mostrar placeholder
  if (!data || !data.datos || data.datos.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#7a84a0',
          fontSize: 12
        }}
      >
        {!data ? 'Configura los datos' : 'Sin datos'}
      </div>
    );
  }

  const { datos } = data;

  switch (widget.tipo) {
    case 'bar':
      return <BarChartWidget widget={widget} datos={datos} width={innerWidth} height={innerHeight} />;
    case 'bar_horizontal':
      return <BarHorizontalWidget widget={widget} datos={datos} width={innerWidth} height={innerHeight} />;
    case 'line':
      return <LineChartWidget widget={widget} datos={datos} width={innerWidth} height={innerHeight} />;
    case 'area':
      return <AreaChartWidget widget={widget} datos={datos} width={innerWidth} height={innerHeight} />;
    case 'pie':
      return <PieChartWidget widget={widget} datos={datos} width={innerWidth} height={innerHeight} />;
    default:
      return (
        <div style={{ color: '#e85d4a', fontSize: 11 }}>
          Tipo de gráfico no implementado: {widget.tipo}
        </div>
      );
  }
}

// ========== GRÁFICOS INDIVIDUALES ==========

function BarChartWidget({ widget, datos, width, height }: { widget: any; datos: any[]; width: number; height: number }) {
  const estilo = widget.config?.estilo || {};
  const color = estilo.color_principal || '#7dc244';
  const padding = estilo.padding ?? 12;
  const opacidad = estilo.opacidad ?? 1;

  return (
    <div style={{ opacity: opacidad }}>
      <ResponsiveContainer width={width} height={height}>
        <BarChart data={datos} margin={{ top: padding, right: padding, bottom: padding, left: padding }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ef" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#7a84a0', fontSize: 10 }}
            stroke="#e2e6ef"
            axisLine={false}
          />
          <YAxis
            tick={{ fill: '#7a84a0', fontSize: 10 }}
            stroke="#e2e6ef"
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#1b2d5e',
              border: 'none',
              borderRadius: 4,
              color: '#ffffff'
            }}
          />
          <Bar dataKey="value" fill={color} radius={[4, 0, 0, 4]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function BarHorizontalWidget({ widget, datos, width, height }: { widget: any; datos: any[]; width: number; height: number }) {
  const estilo = widget.config?.estilo || {};
  const colorPrincipal = estilo.color_principal || '#7dc244';
  const padding = estilo.padding ?? 12;
  const opacidad = estilo.opacidad ?? 1;
  const paletaPersonalizada = [colorPrincipal, ...CHART_COLORS.slice(1)];

  return (
    <div style={{ opacity: opacidad }}>
      <ResponsiveContainer width={width} height={height}>
        <BarChart
          data={datos}
          layout="horizontal"
          margin={{ top: padding, right: padding, left: padding * 5, bottom: padding }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ef" />
          <XAxis
            type="number"
            tick={{ fill: '#7a84a0', fontSize: 10 }}
            stroke="#e2e6ef"
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: '#7a84a0', fontSize: 10 }}
            stroke="#e2e6ef"
            axisLine={false}
            width={60}
          />
          <Tooltip
            contentStyle={{
              background: '#1b2d5e',
              border: 'none',
              borderRadius: 4,
              color: '#ffffff'
            }}
          />
          <Bar dataKey="value" fill={colorPrincipal} radius={[0, 4, 4, 0]}>
            {datos.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={paletaPersonalizada[index % paletaPersonalizada.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LineChartWidget({ widget, datos, width, height }: { widget: any; datos: any[]; width: number; height: number }) {
  const estilo = widget.config?.estilo || {};
  const color = estilo.color_principal || '#7dc244';
  const padding = estilo.padding ?? 12;
  const opacidad = estilo.opacidad ?? 1;

  return (
    <div style={{ opacity: opacidad }}>
      <ResponsiveContainer width={width} height={height}>
        <LineChart data={datos} margin={{ top: padding, right: padding, bottom: padding, left: padding }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ef" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#7a84a0', fontSize: 10 }}
            stroke="#e2e6ef"
            axisLine={false}
          />
          <YAxis
            tick={{ fill: '#7a84a0', fontSize: 10 }}
            stroke="#e2e6ef"
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#1b2d5e',
              border: 'none',
              borderRadius: 4,
              color: '#ffffff'
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            dot={{ fill: color, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function AreaChartWidget({ widget, datos, width, height }: { widget: any; datos: any[]; width: number; height: number }) {
  const estilo = widget.config?.estilo || {};
  const color = estilo.color_principal || '#7dc244';
  const padding = estilo.padding ?? 12;
  const opacidad = estilo.opacidad ?? 1;

  return (
    <div style={{ opacity: opacidad }}>
      <ResponsiveContainer width={width} height={height}>
        <AreaChart data={datos} margin={{ top: padding, right: padding, bottom: padding, left: padding }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ef" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#7a84a0', fontSize: 10 }}
            stroke="#e2e6ef"
            axisLine={false}
          />
          <YAxis
            tick={{ fill: '#7a84a0', fontSize: 10 }}
            stroke="#e2e6ef"
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: '#1b2d5e',
              border: 'none',
              borderRadius: 4,
              color: '#ffffff'
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function PieChartWidget({ widget, datos, width, height }: { widget: any; datos: any[]; width: number; height: number }) {
  const estilo = widget.config?.estilo || {};
  const colorPrincipal = estilo.color_principal || '#7dc244';
  const opacidad = estilo.opacidad ?? 1;
  const paletaPersonalizada = [colorPrincipal, ...CHART_COLORS.slice(1)];

  return (
    <div style={{ opacity: opacidad }}>
      <ResponsiveContainer width={width} height={height}>
        <PieChart>
          <Pie
            data={datos}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(entry: any) => `${entry.label}: ${(entry.percent * 100).toFixed(0)}%`}
          >
            {datos.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={paletaPersonalizada[index % paletaPersonalizada.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: '#1b2d5e',
              border: 'none',
              borderRadius: 4,
              color: '#ffffff'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
