import { Check } from 'lucide-react'
import { GMAIL_LABEL_COLORS, type GmailLabelColor } from './gmail-colors'
import { cn } from '@/lib/utils'

interface LabelColorPickerProps {
  value: GmailLabelColor | null
  onChange: (color: GmailLabelColor) => void
}

export function LabelColorPicker({ value, onChange }: LabelColorPickerProps) {
  const isSelected = (color: GmailLabelColor) => {
    if (!value) return false
    return (
      color.backgroundColor.toLowerCase() === value.backgroundColor.toLowerCase() &&
      color.textColor.toLowerCase() === value.textColor.toLowerCase()
    )
  }

  return (
    <div className="grid grid-cols-7 gap-1.5 p-2 bg-muted/50 rounded-lg">
      {GMAIL_LABEL_COLORS.map((color, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            'w-7 h-7 rounded-md border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary',
            isSelected(color) ? 'border-primary ring-2 ring-primary' : 'border-transparent'
          )}
          style={{ backgroundColor: color.backgroundColor }}
          title={color.backgroundColor}
        >
          {isSelected(color) && (
            <Check className="w-4 h-4 mx-auto" style={{ color: color.textColor }} />
          )}
        </button>
      ))}
    </div>
  )
}
