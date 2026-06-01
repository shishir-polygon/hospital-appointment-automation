'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getHospitals, getHospital, updateHospital, updateHospitalAdmin } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import {
  Building2, Plus, Search, MapPin, Phone, Users, Stethoscope,
  X, Save, Shield, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, User,
} from 'lucide-react'

type Hospital = {
  id: number; name: string; address?: string; city?: string
  phone?: string; email?: string; twilio_phone_number?: string
  status?: string; departments_count?: number; doctors_count?: number
  admin_user?: { id: number; name: string; email: string } | null
}

function Banner({ type, text }: { type: 'success' | 'error'; text: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${
      type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'
    }`}>
      {type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {text}
    </div>
  )
}

function EditModal({ hospital, onClose }: { hospital: Hospital; onClose: () => void }) {
  const queryClient = useQueryClient()

  // Fetch full hospital (includes admin_user)
  const { data: full } = useQuery({
    queryKey: ['hospital', hospital.id],
    queryFn: () => getHospital(hospital.id),
  })

  const adminUser = full?.admin_user ?? null

  // Hospital info form
  const [form, setForm] = useState({
    name: hospital.name ?? '',
    address: hospital.address ?? '',
    city: hospital.city ?? '',
    phone: hospital.phone ?? '',
    email: hospital.email ?? '',
    twilio_phone_number: hospital.twilio_phone_number ?? '',
    status: hospital.status ?? 'active',
  })
  const [infoMsg, setInfoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Admin credentials form
  const [adminEmail, setAdminEmail]   = useState('')
  const [adminPw, setAdminPw]         = useState('')
  const [adminConfirm, setAdminConfirm] = useState('')
  const [showPw, setShowPw]           = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [adminMsg, setAdminMsg]       = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const infoMutation = useMutation({
    mutationFn: () => updateHospital(hospital.id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospitals'] })
      setInfoMsg({ type: 'success', text: 'Hospital info saved.' })
      setTimeout(() => setInfoMsg(null), 3000)
    },
    onError: (e: any) => setInfoMsg({ type: 'error', text: e?.response?.data?.message ?? 'Failed to save.' }),
  })

  const adminMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = {}
      if (adminEmail) payload.email = adminEmail
      if (adminPw)    { payload.password = adminPw; payload.password_confirmation = adminConfirm }
      return updateHospitalAdmin(hospital.id, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hospital', hospital.id] })
      setAdminEmail(''); setAdminPw(''); setAdminConfirm('')
      setAdminMsg({ type: 'success', text: 'Admin credentials updated.' })
      setTimeout(() => setAdminMsg(null), 3000)
    },
    onError: (e: any) => setAdminMsg({ type: 'error', text: e?.response?.data?.message ?? 'Failed to update.' }),
  })

  const handleAdminSave = () => {
    if (!adminEmail && !adminPw) return setAdminMsg({ type: 'error', text: 'Enter a new email or password to update.' })
    if (adminPw && adminPw.length < 8) return setAdminMsg({ type: 'error', text: 'Password must be at least 8 characters.' })
    if (adminPw && adminPw !== adminConfirm) return setAdminMsg({ type: 'error', text: 'Passwords do not match.' })
    setAdminMsg(null)
    adminMutation.mutate()
  }

  const field = (label: string, key: keyof typeof form, placeholder = '', type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-500" />
            <h2 className="font-semibold text-gray-900">Edit Hospital</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-6">

          {/* ── Hospital Info ────────────────────────────────────────── */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5" /> Hospital Information
            </h3>
            {field('Hospital Name', 'name')}
            <div className="grid grid-cols-2 gap-3">
              {field('City', 'city', 'Dhaka')}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            {field('Address', 'address', '123 Medical Road')}
            <div className="grid grid-cols-2 gap-3">
              {field('Phone', 'phone', '+8801700000000')}
              {field('Email', 'email', 'info@hospital.com', 'email')}
            </div>
            {field('Twilio Phone Number', 'twilio_phone_number', '+1234567890')}
            {infoMsg && <Banner type={infoMsg.type} text={infoMsg.text} />}
            <div className="flex justify-end">
              <button
                onClick={() => infoMutation.mutate()}
                disabled={infoMutation.isPending}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {infoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Info
              </button>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* ── Hospital Admin Credentials ───────────────────────────── */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" /> Hospital Admin Credentials
            </h3>

            {/* Current admin info */}
            <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {adminUser?.name ?? 'No admin user'}
                </p>
                <p className="text-xs text-gray-500">
                  {adminUser?.email ?? 'No login set up yet'}
                </p>
              </div>
            </div>

            {/* New email */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">New Email Address</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder={adminUser?.email ?? 'admin@hospital.com'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* New password */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={adminPw}
                  onChange={(e) => setAdminPw(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={adminConfirm}
                  onChange={(e) => setAdminConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password strength */}
            {adminPw && (
              <div className="flex gap-2 flex-wrap">
                {[
                  { ok: adminPw.length >= 8, label: '8+ chars' },
                  { ok: /[A-Z]/.test(adminPw), label: 'Uppercase' },
                  { ok: /[0-9]/.test(adminPw), label: 'Number' },
                ].map(({ ok, label }) => (
                  <span key={label} className={`text-xs px-2 py-0.5 rounded-full border ${
                    ok ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'
                  }`}>{ok ? '✓' : '○'} {label}</span>
                ))}
              </div>
            )}

            {adminMsg && <Banner type={adminMsg.type} text={adminMsg.text} />}

            <div className="flex justify-end">
              <button
                onClick={handleAdminSave}
                disabled={adminMutation.isPending}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60"
              >
                {adminMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Update Credentials
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HospitalsPage() {
  const [search, setSearch] = useState('')
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null)
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: ['hospitals', search],
    queryFn: () => getHospitals({ search: search || undefined }),
  })

  const hospitals: Hospital[] = data?.data ?? []

  return (
    <DashboardLayout>
      {editingHospital && (
        <EditModal hospital={editingHospital} onClose={() => setEditingHospital(null)} />
      )}

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="page-title">Hospitals</h1>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add Hospital
          </button>
        </div>

        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm max-w-md">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            placeholder="Search hospitals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="outline-none text-sm flex-1"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm animate-pulse">
                <div className="flex gap-4">
                  <div className="w-14 h-14 bg-gray-200 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-36" />
                    <div className="h-3 bg-gray-100 rounded w-28" />
                    <div className="h-3 bg-gray-100 rounded w-44" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {hospitals.map((h) => (
              <div key={h.id} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white flex-shrink-0">
                    <Building2 className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">{h.name}</h3>
                      {h.status && h.status !== 'active' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100">{h.status}</span>
                      )}
                    </div>
                    {h.address && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" />{h.address}
                      </p>
                    )}
                    {h.phone && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 flex-shrink-0" />{h.phone}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {(h.doctors_count ?? 0) > 0 && (
                        <p className="text-xs text-blue-600 flex items-center gap-1">
                          <Stethoscope className="w-3 h-3" />{h.doctors_count} doctors
                        </p>
                      )}
                      {(h.departments_count ?? 0) > 0 && (
                        <p className="text-xs text-indigo-600 flex items-center gap-1">
                          <Users className="w-3 h-3" />{h.departments_count} depts
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50 flex gap-2">
                  <button
                    onClick={() => router.push(`/doctors?hospital_id=${h.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 px-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                  >
                    <Stethoscope className="w-3 h-3" /> View Doctors
                  </button>
                  <button
                    onClick={() => setEditingHospital(h)}
                    className="flex-1 text-xs py-1.5 px-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 text-blue-700"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && hospitals.length === 0 && (
          <div className="py-20 text-center text-gray-400">
            <Building2 className="w-14 h-14 mx-auto mb-3 opacity-30" />
            <p>No hospitals found</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
