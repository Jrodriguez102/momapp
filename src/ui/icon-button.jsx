import { Button } from '@/ui/button'

// Icon-only button: always at least 44x44, and `label` is required — it
// becomes the accessible name (the icon itself is aria-hidden by lucide).
export function IconButton({ label, children, variant = 'ghost', size = 'icon', ...props }) {
  if (import.meta.env.DEV && !label) console.warn('IconButton needs a `label` for its accessible name')
  return (
    <Button aria-label={label} title={label} variant={variant} size={size} {...props}>
      {children}
    </Button>
  )
}
