import { clsx } from 'clsx'

type Color = 'blue' | 'green' | 'purple' | 'teal' | 'orange' | 'rose'

const colorMap: Record<Color, string> = {
  blue: 'bg-blue-50 border-blue-100',
  green: 'bg-green-50 border-green-100',
  purple: 'bg-purple-50 border-purple-100',
  teal: 'bg-teal-50 border-teal-100',
  orange: 'bg-orange-50 border-orange-100',
  rose: 'bg-rose-50 border-rose-100',
}

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  color: Color
  change?: string
}

export function StatCard({ title, value, icon, color, change }: StatCardProps) {
  return (
    <div className={clsx('stat-card', colorMap[color])}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change && <p className="text-xs text-gray-500 mt-1">{change}</p>}
        </div>
        <div className="p-2 rounded-lg bg-white shadow-sm">{icon}</div>
      </div>
    </div>
  )
}
