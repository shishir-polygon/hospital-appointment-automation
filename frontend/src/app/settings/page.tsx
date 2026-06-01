'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getMe, updateProfile } from '@/lib/api'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { User, Shield, Globe, Save, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function Banner({ type, text }: { type: 'success' | 'error'; text: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg border ${
      type === 'success'
        ? 'bg-green-50 text-green-700 border-green-200'
        : 'bg-red-50 text-red-600 border-red-200'
    }`}>
      {type === 'success'
        ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
        : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {text}
    </div>
  )
}

function PwInput({
  label, value, onChange, show, setShow, placeholder = '••••••••',
}: {
  label: string; value: string; onChange: (v: string) => void
  show: boolean; setShow: (v: boolean) => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

// ── Profile form (rendered only after me loads, keyed to reset state) ─────────

function ProfileForm({ me }: { me: { id: number; name: string; email: string; role: string } }) {
  const queryClient = useQueryClient()
  const [name, setName]   = useState(me.name)
  const [email, setEmail] = useState(me.email)
  const [msg, setMsg]     = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const mutation = useMutation({
    mutationFn: () => updateProfile({ name, email }),
    onSuccess: (data) => {
      queryClient.setQueryData(['me'], data.user)
      setMsg({ type: 'success', text: 'Profile updated successfully.' })
      setTimeout(() => setMsg(null), 3000)
    },
    onError: (err: any) => {
      setMsg({ type: 'error', text: err?.response?.data?.message ?? 'Failed to update profile.' })
    },
  })

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
        <User className="w-4 h-4 text-blue-500" />
        <h2 className="font-semibold text-gray-800 text-sm">Profile</h2>
        <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
          {me.role.replace('_', ' ')}
        </span>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">You will need to log in again after changing your email.</p>
        </div>
        {msg && <Banner type={msg.type} text={msg.text} />}
        <div className="flex justify-end">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {mutation.isPending ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Password form ─────────────────────────────────────────────────────────────

function PasswordForm() {
  const [currentPw, setCurrentPw]     = useState('')
  const [newPw, setNewPw]             = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [msg, setMsg]                 = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const mutation = useMutation({
    mutationFn: () => updateProfile({
      current_password: currentPw,
      password: newPw,
      password_confirmation: confirmPw,
    }),
    onSuccess: () => {
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setMsg({ type: 'success', text: 'Password changed successfully.' })
      setTimeout(() => setMsg(null), 3000)
    },
    onError: (err: any) => {
      setMsg({ type: 'error', text: err?.response?.data?.message ?? 'Failed to change password.' })
    },
  })

  const handleSubmit = () => {
    if (!currentPw) return setMsg({ type: 'error', text: 'Enter your current password.' })
    if (newPw.length < 8) return setMsg({ type: 'error', text: 'New password must be at least 8 characters.' })
    if (newPw !== confirmPw) return setMsg({ type: 'error', text: 'Passwords do not match.' })
    setMsg(null)
    mutation.mutate()
  }

  const strength = [
    { ok: newPw.length >= 8, label: '8+ chars' },
    { ok: /[A-Z]/.test(newPw), label: 'Uppercase' },
    { ok: /[0-9]/.test(newPw), label: 'Number' },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
        <Shield className="w-4 h-4 text-red-500" />
        <h2 className="font-semibold text-gray-800 text-sm">Change Password</h2>
      </div>
      <div className="px-6 py-5 space-y-4">
        <PwInput label="Current Password" value={currentPw} onChange={setCurrentPw} show={showCurrent} setShow={setShowCurrent} />
        <PwInput label="New Password" value={newPw} onChange={setNewPw} show={showNew} setShow={setShowNew} placeholder="Min. 8 characters" />
        <PwInput label="Confirm New Password" value={confirmPw} onChange={setConfirmPw} show={showConfirm} setShow={setShowConfirm} />
        {newPw && (
          <div className="flex gap-2 flex-wrap">
            {strength.map(({ ok, label }) => (
              <span key={label} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                ok ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'
              }`}>
                {ok ? '✓' : '○'} {label}
              </span>
            ))}
          </div>
        )}
        {msg && <Banner type={msg.type} text={msg.text} />}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex items-center gap-2 bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {mutation.isPending ? 'Changing…' : 'Change Password'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: me, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    staleTime: 0,        // always fetch fresh on settings page
    retry: 1,
  })

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="page-title">Settings</h1>

        {/* Profile — loading skeleton */}
        {isLoading && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-20" />
            <div className="h-10 bg-gray-100 rounded" />
            <div className="h-10 bg-gray-100 rounded" />
            <div className="h-9 bg-gray-200 rounded w-32 ml-auto" />
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-600 text-sm">
            Could not load profile. Please refresh the page or log in again.
          </div>
        )}

        {/* Profile form — only rendered when me is loaded, keyed by id to reset state */}
        {me && <ProfileForm key={me.id} me={me} />}

        {/* Password — always visible */}
        <PasswordForm />

        {/* AI Service info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50">
            <Globe className="w-4 h-4 text-indigo-500" />
            <h2 className="font-semibold text-gray-800 text-sm">AI Voice Service</h2>
          </div>
          <div className="px-6 py-5 divide-y divide-gray-50">
            {[
              { label: 'AI Service', desc: 'FastAPI voice booking engine', badge: 'Running :8001', color: 'green' },
              { label: 'LLM', desc: 'Groq — llama-3.3-70b-versatile', badge: 'Free tier', color: 'blue' },
              { label: 'Speech-to-Text', desc: 'Groq Whisper large-v3', badge: 'Free tier', color: 'blue' },
              { label: 'Text-to-Speech', desc: 'Microsoft Edge TTS', badge: 'Free', color: 'green' },
            ].map(({ label, desc, badge, color }) => (
              <div key={label} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  color === 'green' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                }`}>{badge}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
