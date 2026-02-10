import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon className="w-8 h-8 text-win-dark mb-2" strokeWidth={1} />
      <p className="text-[11px] font-bold text-black mb-0.5">{title}</p>
      <p className="text-[11px] text-win-dark max-w-xs">{description}</p>
      {action && (
        <button onClick={action.onClick} className="btn-primary mt-3">
          {action.label}
        </button>
      )}
    </div>
  )
}
