'use client'

import { useQuery } from '@tanstack/react-query'
import { getDashboard, getCallTrends, getTopDoctors, getPeakHours } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { StatCard } from '@/components/ui/StatCard'
import { CallTrendsChart } from '@/components/charts/CallTrendsChart'
import { TopDoctorsChart } from '@/components/charts/TopDoctorsChart'
import { PeakHoursChart } from '@/components/charts/PeakHoursChart'
import { Phone, Calendar, UserCheck, Activity, TrendingUp, Clock } from 'lucide-react'

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard, refetchInterval: 30_000 })
  const { data: trends } = useQuery({ queryKey: ['call-trends', 7], queryFn: () => getCallTrends(7) })
  const { data: topDocs } = useQuery({ queryKey: ['top-doctors'], queryFn: getTopDoctors })
  const { data: peakHours } = useQuery({ queryKey: ['peak-hours'], queryFn: getPeakHours })

  if (isLoading) return <DashboardLayout><LoadingSkeleton /></DashboardLayout>

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="page-title">Dashboard</h1>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            title="Calls Today"
            value={stats?.calls_today ?? 0}
            icon={<Phone className="w-5 h-5 text-blue-500" />}
            color="blue"
          />
          <StatCard
            title="Bookings Today"
            value={stats?.bookings_today ?? 0}
            icon={<Calendar className="w-5 h-5 text-green-500" />}
            color="green"
          />
          <StatCard
            title="AI Bookings"
            value={stats?.ai_bookings_today ?? 0}
            icon={<Activity className="w-5 h-5 text-purple-500" />}
            color="purple"
          />
          <StatCard
            title="Active Doctors"
            value={stats?.active_doctors ?? 0}
            icon={<UserCheck className="w-5 h-5 text-teal-500" />}
            color="teal"
          />
          <StatCard
            title="Success Rate"
            value={`${stats?.success_rate ?? 0}%`}
            icon={<TrendingUp className="w-5 h-5 text-orange-500" />}
            color="orange"
          />
          <StatCard
            title="Avg Call (sec)"
            value={Math.round(stats?.avg_call_duration ?? 0)}
            icon={<Clock className="w-5 h-5 text-rose-500" />}
            color="rose"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">Call Trends (7 days)</h2>
            <CallTrendsChart data={trends ?? []} />
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">Peak Hours</h2>
            <PeakHoursChart data={peakHours ?? []} />
          </div>
        </div>

        {/* Top Doctors */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">Top Doctors This Month</h2>
          <TopDoctorsChart data={topDocs ?? []} />
        </div>
      </div>
    </DashboardLayout>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="grid grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => <div key={i} className="h-64 bg-gray-200 rounded-xl" />)}
      </div>
    </div>
  )
}
