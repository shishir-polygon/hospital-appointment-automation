'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { format, parseISO } from 'date-fns'

interface Props {
  data: { date: string; calls: number; avg_duration: number }[]
}

export function CallTrendsChart({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    date: format(parseISO(d.date), 'MMM d'),
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={formatted}>
        <defs>
          <linearGradient id="callGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          labelStyle={{ fontWeight: 600 }}
        />
        <Area
          type="monotone"
          dataKey="calls"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#callGradient)"
          name="Calls"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
