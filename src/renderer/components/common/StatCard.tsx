import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  color?: string
  subtitle?: string
}

export function StatCard({ label, value, icon: Icon, subtitle }: StatCardProps) {
  return (
    <div className="shadow-win-in bg-white p-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] text-win-dark">{label}</p>
          <p className="text-[14px] font-bold text-black mt-0.5">{value}</p>
          {subtitle && <p className="text-[10px] text-win-dark mt-0.5">{subtitle}</p>}
        </div>
        <Icon className="w-4 h-4 text-win-dark" strokeWidth={1.5} />
      </div>
    </div>
  )
}
