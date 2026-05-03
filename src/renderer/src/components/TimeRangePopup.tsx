import { useEffect, useRef } from 'react'
import { X, Calendar, Clock } from 'lucide-react'

type TimeRangePopupProps = {
  startDate: string
  endDate: string
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  onClose: () => void
}

export default function TimeRangePopup({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClose
}: TimeRangePopupProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [onClose])

  const handleMouseEnter = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => {
      onClose()
    }, 800) // 800ms grace period before closing
  }

  return (
    <div 
      className="time-range-popup" 
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="time-range-popup__header">
        <span>Range Filter</span>
        <button className="close-btn" onClick={onClose} title="Close">
          <X size={14} />
        </button>
      </div>
      
      <div className="time-range-popup__body">
        <div className="range-field">
          <label>
            <Calendar size={12} />
            Start Date-Time
          </label>
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>
        
        <div className="range-field">
          <label>
            <Clock size={12} />
            End Date-Time
          </label>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
        </div>
      </div>
      
      {(startDate || endDate) && (
        <div className="time-range-popup__footer">
          <button 
            className="clear-text-btn" 
            onClick={() => {
              onStartDateChange('')
              onEndDateChange('')
            }}
          >
            Reset Range
          </button>
        </div>
      )}
    </div>
  )
}
