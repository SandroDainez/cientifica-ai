import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number // 0-100
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function ProgressBar({ value, showLabel = true, size = 'sm', className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const color =
    clamped === 100 ? 'bg-green-500' :
    clamped >= 60   ? 'bg-primary' :
    clamped >= 30   ? 'bg-yellow-400' :
                      'bg-gray-300'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('flex-1 rounded-full bg-gray-100', size === 'sm' ? 'h-1.5' : 'h-2.5')}>
        <div
          className={cn('rounded-full transition-all duration-500', color, size === 'sm' ? 'h-1.5' : 'h-2.5')}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-muted-foreground w-8 text-right shrink-0">
          {clamped}%
        </span>
      )}
    </div>
  )
}
