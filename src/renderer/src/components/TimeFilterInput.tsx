import { useState, useRef } from 'react'
import { CalendarClock } from 'lucide-react'
import TimeRangePopup from './TimeRangePopup'
import Button from './Button'

type TimeFilterInputProps = {
  column: string
  value: string
  startDate: string
  endDate: string
  onChange: (value: string) => void
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  placeholder: string
}

export default function TimeFilterInput({
  value,
  startDate,
  endDate,
  onChange,
  onStartDateChange,
  onEndDateChange,
  placeholder
}: TimeFilterInputProps) {
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const hasRangeActive = !!(startDate || endDate)

  return (
    <div className="filter-cell time-filter-cell" ref={containerRef}>
      <div className="time-filter-input-wrapper">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <Button 
          variant={hasRangeActive ? 'secondary' : 'ghost'}
          size="sm"
          isIconOnly
          onClick={() => setIsPopupOpen(!isPopupOpen)}
          title="Open Date-Time Range Picker"
          icon={<CalendarClock size={16} />}
        />
      </div>

      {isPopupOpen && (
        <TimeRangePopup
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
          onClose={() => setIsPopupOpen(false)}
        />
      )}
    </div>
  )
}
