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
  const innerHeight = height - (widget.mostrar_titulo ? 32 : 0);
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
      return <BarChartWidget datos={datos} width={innerWidth} height={innerHeight} />;
    case 'bar_horizontal':
      return <BarHorizontalWidget datos={datos} width={innerWidth} height={innerHeight} />;
    case 'line':
      return <LineChartWidget datos={datos} width={innerWidth} height={innerHeight} />;
    case 'area':
      return <AreaChartWidget datos={datos} width={innerWidth} height={innerHeight} />;
    case 'pie':
      return <PieChartWidget datos={datos} width={innerWidth} height={innerHeight} />;
    default:
      return (
        <div style={{ color: '#e85d4a', fontSize: 11 }}>
          Tipo de gráfico no implementado: {widget.tipo}
        </div>
      );
  }
}

// ========== GRÁFICOS INDIVIDUALES ==========

function BarChartWidget({ datos, width, height }: { datos: any[]; width: number; height: number }) {
  return (
    <ResponsiveContainer width={width} height={height}>
      <BarChart data={datos}>
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
        <Bar dataKey="value" fill="#7dc244" radius={[4, 0, 0, 4]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BarHorizontalWidget({ datos, width, height }: { datos: any[]; width: number; height: number }) {
  return (
    <ResponsiveContainer width={width} height={height}>
      <BarChart
        data={datos}
        layout="horizontal"
        margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
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
        <Bar dataKey="value" fill="#7dc244" radius={[0, 4, 4, 0]}>
          {datos.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function LineChartWidget({ datos, width, height }: { datos: any[]; width: number; height: number }) {
  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={datos}>
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
          stroke="#7dc244"
          strokeWidth={2.5}
          dot={{ fill: '#7dc244', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function AreaChartWidget({ datos, width, height }: { datos: any[]; width: number; height: number }) {
  return (
    <ResponsiveContainer width={width} height={height}>
      <AreaChart data={datos}>
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
          stroke="#7dc244"
          fill="#7dc244"
          fillOpacity={0.2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function PieChartWidget({ datos, width, height }: { datos: any[]; width: number; height: number }) {
  return (
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
              fill={CHART_COLORS[index % CHART_COLORS.length]}
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
  );
}
