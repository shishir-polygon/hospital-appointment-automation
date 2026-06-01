'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAppointments, updateAppointment, getHospitals, getDoctors } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { format } from 'date-fns'
import { Calendar, Search, Phone, CheckCircle, XCircle, Building2, Stethoscope } from 'lucide-react'
import { clsx } from 'clsx'

const statusColors: Record<string, string> = {
  scheduled:   'bg-blue-100 text-blue-700',
  confirmed:   'bg-green-100 text-green-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed:   'bg-emerald-100 text-emerald-700',
  cancelled:   'bg-red-100 text-red-700',
  no_show:     'bg-gray-100 text-gray-600',
}

const channelIcon: Record<string, React.ReactNode> = {
  ai_voice: <Phone className="w-3 h-3" />,
  manual:   <span className="text-[10px]">M</span>,
  web:      <span className="text-[10px]">W</span>,
}

export default function AppointmentsPage() {
  const queryClient = useQueryClient()
  const [date, setDate]               = useState('')
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatus]     = useState('')
  const [hospitalId, setHospitalId]   = useState('')
  const [doctorId, setDoctorId]       = useState('')

  // Load hospitals for filter dropdown
  const { data: hospitalsData } = useQuery({
    queryKey: ['hospitals-list'],
    queryFn: () => getHospitals({ per_page: 100 }),
  })

  // Load doctors filtered by selected hospital
  const { data: doctorsData } = useQuery({
    queryKey: ['doctors-for-filter', hospitalId],
    queryFn: () => getDoctors({
      hospital_id: hospitalId || undefined,
      active_only: false,
      per_page: 200,
    }),
    enabled: true,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', date, search, statusFilter, hospitalId, doctorId],
    queryFn: () => getAppointments({
      date:        date || undefined,
      search:      search || undefined,
      status:      statusFilter || undefined,
      hospital_id: hospitalId || undefined,
      doctor_id:   doctorId || undefined,
    }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => updateAppointment(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  })

  const appointments = data?.data ?? []
  const hospitals    = hospitalsData?.data ?? []
  const doctors      = doctorsData?.data ?? []

  const clearFilters = () => {
    setDate(''); setSearch(''); setStatus(''); setHospitalId(''); setDoctorId('')
  }
  const hasFilters = date || search || statusFilter || hospitalId || doctorId

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="page-title">Appointments</h1>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-red-500 border border-gray-200 rounded-lg px-3 py-1.5">
              ✕ Clear filters
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex flex-wrap gap-3">
          {/* Date */}
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-sm outline-none"
            />
            {date && <button onClick={() => setDate('')} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>}
          </div>

          {/* Hospital filter */}
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            <select
              value={hospitalId}
              onChange={(e) => { setHospitalId(e.target.value); setDoctorId('') }}
              className="text-sm outline-none bg-transparent"
            >
              <option value="">All Hospitals</option>
              {hospitals.map((h: any) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          {/* Doctor filter */}
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
            <Stethoscope className="w-4 h-4 text-gray-400" />
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="text-sm outline-none bg-transparent"
            >
              <option value="">All Doctors</option>
              {doctors.map((d: any) => (
                <option key={d.id} value={d.id}>{d.title} {d.name}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-40">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              placeholder="Search patient name / phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm outline-none w-full"
            />
          </div>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none"
          >
            <option value="">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['#', 'Patient', 'Doctor', 'Hospital', 'Date', 'Status', 'Channel', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading
                ? [...Array(6)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[...Array(8)].map((_, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                      ))}
                    </tr>
                  ))
                : appointments.map((apt: any) => (
                    <tr key={apt.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-blue-600">#{apt.serial_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{apt.patient?.name}</div>
                        <div className="text-xs text-gray-400">{apt.patient?.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{apt.doctor?.title} {apt.doctor?.name}</div>
                        <div className="text-xs text-gray-400">{apt.doctor?.department?.name}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {apt.hospital?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {apt.appointment_date ? format(new Date(apt.appointment_date), 'dd MMM yyyy') : '—'}
                        {apt.appointment_time && <div className="text-gray-400">{apt.appointment_time}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('px-2 py-1 rounded-full text-xs font-medium', statusColors[apt.status] ?? 'bg-gray-100 text-gray-600')}>
                          {apt.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          {channelIcon[apt.booking_channel]}
                          {apt.booking_channel === 'ai_voice' ? 'AI Voice' : apt.booking_channel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {apt.status === 'scheduled' && (
                            <>
                              <button
                                title="Mark completed"
                                onClick={() => updateMutation.mutate({ id: apt.id, data: { status: 'completed' } })}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                title="Cancel"
                                onClick={() => updateMutation.mutate({ id: apt.id, data: { status: 'cancelled' } })}
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>

          {!isLoading && appointments.length === 0 && (
            <div className="py-16 text-center text-gray-400">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No appointments found</p>
              {hasFilters && <p className="text-xs mt-1">Try clearing the filters above</p>}
            </div>
          )}
        </div>

        {data?.total !== undefined && (
          <div className="text-sm text-gray-500">
            {data.total} appointment{data.total !== 1 ? 's' : ''} found
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
