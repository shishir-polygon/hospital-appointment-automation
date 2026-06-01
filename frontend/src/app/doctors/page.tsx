'use client'

import { useState, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { getDoctors, getDoctorQueue } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Stethoscope, Plus, Search, Users, Clock, DollarSign, Building2 } from 'lucide-react'
import { clsx } from 'clsx'

function QueueBadge({ doctorId }: { doctorId: number }) {
  const { data } = useQuery({
    queryKey: ['doctor-queue', doctorId],
    queryFn: () => getDoctorQueue(doctorId),
    refetchInterval: 15_000,
  })

  if (!data) return null

  return (
    <div className="flex items-center gap-3 mt-2 text-xs">
      <span className={clsx('flex items-center gap-1', data.doctor_available ? 'text-green-600' : 'text-red-500')}>
        <span className={clsx('w-2 h-2 rounded-full', data.doctor_available ? 'bg-green-500 animate-pulse' : 'bg-red-400')} />
        {data.doctor_available ? 'Available' : 'Unavailable'}
      </span>
      {data.doctor_available && (
        <>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">
            <Users className="w-3 h-3 inline mr-0.5" />{data.waiting_count} waiting
          </span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">
            <Clock className="w-3 h-3 inline mr-0.5" />~{data.estimated_wait_minutes}m wait
          </span>
        </>
      )}
    </div>
  )
}

export default function DoctorsPage() {
  return (
    <Suspense fallback={<DashboardLayout><div className="p-8 text-gray-400">Loading...</div></DashboardLayout>}>
      <DoctorsContent />
    </Suspense>
  )
}

function DoctorsContent() {
  const [search, setSearch] = useState('')
  const searchParams = useSearchParams()
  const hospitalId = searchParams.get('hospital_id')

  const { data, isLoading } = useQuery({
    queryKey: ['doctors', search, hospitalId],
    queryFn: () => getDoctors({
      search: search || undefined,
      hospital_id: hospitalId || undefined,
    }),
  })

  const doctors = data?.data ?? []

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="page-title">Doctors</h1>
            {hospitalId && (
              <a
                href="/doctors"
                className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-full hover:bg-blue-100"
              >
                <Building2 className="w-3 h-3" />
                Hospital #{hospitalId}
                <span className="ml-1 text-blue-400">×</span>
              </a>
            )}
          </div>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add Doctor
          </button>
        </div>

        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm max-w-md">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            placeholder="Search doctors by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="outline-none text-sm flex-1"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm animate-pulse">
                <div className="flex gap-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-32" />
                    <div className="h-3 bg-gray-100 rounded w-24" />
                    <div className="h-3 bg-gray-100 rounded w-40" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {doctors.map((doc: any) => (
              <div key={doc.id} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {doc.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {doc.title} {doc.name}
                    </h3>
                    <p className="text-sm text-blue-600">{doc.department?.name ?? 'General'}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{doc.specializations}</p>

                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />৳{doc.consultation_fee}
                      </span>
                      <span>·</span>
                      <span>{doc.avg_consultation_minutes}min/patient</span>
                    </div>

                    <QueueBadge doctorId={doc.id} />
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-50 flex gap-2">
                  <button className="flex-1 text-xs py-1.5 px-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                    Schedule
                  </button>
                  <button className="flex-1 text-xs py-1.5 px-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 text-blue-700">
                    Book Appt
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && doctors.length === 0 && (
          <div className="py-20 text-center text-gray-400">
            <Stethoscope className="w-14 h-14 mx-auto mb-3 opacity-30" />
            <p>No doctors found</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
