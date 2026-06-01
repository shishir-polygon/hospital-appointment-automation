'use client'

import { useQuery } from '@tanstack/react-query'
import { getCallTrends, getTopDoctors, getPeakHours } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { BarChart2, TrendingUp, Clock, Stethoscope } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts'

export default function AnalyticsPage() {
  const { data: trends } = useQuery({ queryKey: ['call-trends'], queryFn: () => getCallTrends(7) })
  const { data: topDoctors } = useQuery({ queryKey: ['top-doctors'], queryFn: getTopDoctors })
  const { data: peakHours } = useQuery({ queryKey: ['peak-hours'], queryFn: getPeakHours })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="page-title">Analytics</h1>

        {/* Call trends */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <h2 className="font-semibold text-gray-800">Call Trends (Last 7 Days)</h2>
          </div>
          {trends?.data?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trends.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total_calls" stroke="#3b82f6" name="Total Calls" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="successful_bookings" stroke="#10b981" name="Bookings" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No trend data yet</div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top doctors */}
          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Stethoscope className="w-5 h-5 text-indigo-500" />
              <h2 className="font-semibold text-gray-800">Top Doctors by Appointments</h2>
            </div>
            {topDoctors?.data?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topDoctors.data} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="appointment_count" fill="#6366f1" name="Appointments" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
            )}
          </div>

          {/* Peak hours */}
          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-amber-500" />
              <h2 className="font-semibold text-gray-800">Peak Call Hours</h2>
            </div>
            {peakHours?.data?.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={peakHours.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(h) => `${h}:00`} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={(h) => `${h}:00`} />
                  <Bar dataKey="call_count" fill="#f59e0b" name="Calls" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
            )}
          </div>
        </div>

        {!trends && !topDoctors && !peakHours && (
          <div className="py-16 text-center text-gray-400">
            <BarChart2 className="w-14 h-14 mx-auto mb-3 opacity-30" />
            <p>Analytics data will appear once calls are processed</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
