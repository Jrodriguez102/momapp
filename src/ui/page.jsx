import { cn } from '@/lib/utils'

// Screen content column: phone width, 20px side gutter (16px when `tight`,
// for the workout screen), consistent top spacing and vertical rhythm.
export function Page({ tight = false, className, children }) {
  return (
    <div className={cn('mx-auto w-full max-w-md space-y-5 pt-8 pb-4', tight ? 'px-gutter-tight' : 'px-gutter', className)}>
      {children}
    </div>
  )
}
