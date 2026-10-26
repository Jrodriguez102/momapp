import { useRef, useState } from 'react'
import { logBodyWeight } from '@/services/bodyWeightApi'
import { Button } from '@/ui/button'
import { NumberInput } from '@/ui/number-input'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/ui/sheet'
import { notifyError } from '@/ui/toast'

// Log a body-weight check-in (one body_weight_logs insert: weight +
// logged_at, exactly as before). onLogged: called after a successful save.
export function LogWeightSheet({ open, onOpenChange, onLogged }) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)
  const weight = Number(value)
  const valid = value !== '' && Number.isFinite(weight) && weight > 0

  async function submit(e) {
    e.preventDefault()
    if (!valid) return
    setSaving(true)
    try {
      await logBodyWeight(weight)
      setValue('')
      onOpenChange(false)
      onLogged()
    } catch (err) {
      console.error('Failed to log weight:', err)
      notifyError('Could not save — check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
      >
        <SheetHeader>
          <SheetTitle>Log weight</SheetTitle>
          <SheetDescription>Weigh in at the same time of day for the fairest trend.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <form onSubmit={submit} className="flex items-center gap-2">
            <NumberInput ref={inputRef} label="Body weight (lb)" placeholder="lb" value={value} onChange={(e) => setValue(e.target.value)} />
            <Button type="submit" size="md" disabled={!valid || saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </form>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
