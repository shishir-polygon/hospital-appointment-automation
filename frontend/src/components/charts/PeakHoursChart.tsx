'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  data: { hour: number; calls: number }[]
}

export function PeakHoursChart({ data }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    hour: `${d.hour}:00`,
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          formatter={(val: number) => [`${val}`, 'Calls']}
        />
        <Bar dataKey="calls" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
