'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCallLogs } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Phone, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { format, parseISO } from 'date-fns'

const outcomeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  appointment_booked: { label: 'Booked', color: 'text-green-600 bg-green-50', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  info_provided: { label: 'Info', color: 'text-blue-600 bg-blue-50', icon: <Phone className="w-3.5 h-3.5" /> },
  cancelled: { label: 'Cancelled', color: 'text-red-600 bg-red-50', icon: <XCircle className="w-3.5 h-3.5" /> },
  incomplete: { label: 'Incomplete', color: 'text-yellow-600 bg-yellow-50', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  error: { label: 'Error', color: 'text-gray-600 bg-gray-50', icon: <AlertCircle className="w-3.5 h-3.5" /> },
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function CallLogsPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ['call-logs', page],
    queryFn: () => getCallLogs({ page }),
  })

  const logs = data?.data ?? []

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <h1 className="page-title">Call Logs</h1>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Caller', 'Time', 'Duration', 'Language', 'Outcome', 'Appointment'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading
                ? [...Array(10)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-28" /></td>
                      ))}
                    </tr>
                  ))
                : logs.map((log: any) => {
                    const outcome = outcomeConfig[log.outcome] ?? { label: log.outcome, color: 'text-gray-500 bg-gray-50', icon: null }
                    return (
                      <tr key={log.id} className="table-row-hover">
                        <td className="px-4 py-3">
                          <div className="font-mono text-gray-700">{log.caller_number}</div>
                          <div className="text-xs text-gray-400">{log.call_sid?.slice(0, 12)}…</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {format(parseISO(log.created_at), 'MMM d, HH:mm')}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-gray-600">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {formatDuration(log.duration_seconds)}
                          </span>
                        </td>
                        <td className="px-4 py-3 uppercase text-xs font-medium text-gray-500">{log.language}</td>
                        <td className="px-4 py-3">
                          <span className={clsx('flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium w-fit', outcome.color)}>
                            {outcome.icon} {outcome.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {log.appointment_id
                            ? <span className="text-blue-600 font-medium">#{log.appointment_id}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>

          {!isLoading && logs.length === 0 && (
            <div className="py-16 text-center text-gray-400">
              <Phone className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No call logs yet</p>
            </div>
          )}
        </div>

        {data?.meta && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Page {data.meta.current_page} of {data.meta.last_page} ({data.meta.total} calls)</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-40">Prev</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page === data.meta.last_page} className="px-3 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
