import { useState, useRef, useEffect, useMemo } from 'react'

type FilterInputProps = {
  column: string
  value: string
  suggestions: string[]
  onChange: (value: string) => void
  placeholder: string
}

export default function FilterInput({
  column,
  value,
  suggestions,
  onChange,
  placeholder
}: FilterInputProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [inputValue, setInputValue] = useState(value)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync with external value changes (e.g. "Clear all filters")
  useEffect(() => {
    setInputValue(value)
  }, [value])

  const filteredSuggestions = useMemo(() => {
    if (!inputValue) return suggestions.slice(0, 50)
    const query = inputValue.toLowerCase()
    return suggestions
      .filter((s) => s.toLowerCase().includes(query))
      .slice(0, 50)
  }, [suggestions, inputValue])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        // Revert to the actual applied filter value if user clicks away without selecting
        setInputValue(value)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIsOpen(true)
      setActiveIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0))
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < filteredSuggestions.length) {
        handleSelect(filteredSuggestions[activeIndex])
      } else {
        // Apply whatever is currently in the input on Enter
        handleSelect(inputValue)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setInputValue(value)
    }
  }

  const handleSelect = (s: string) => {
    onChange(s)
    setInputValue(s)
    setIsOpen(false)
    setActiveIndex(-1)
  }

  return (
    <div className="filter-cell" ref={containerRef}>
      <input
        value={inputValue}
        onChange={(e) => {
          const next = e.target.value
          setInputValue(next)
          onChange(next) // ← Fix: apply filter on every keystroke, not just on Enter/select
          setIsOpen(true)
          setActiveIndex(-1)
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {isOpen && (
        <div className="suggestions">
          {filteredSuggestions.length > 0 ? (
            filteredSuggestions.map((s, i) => (
              <div
                key={s}
                className={`suggestion-item ${i === activeIndex ? 'active' : ''}`}
                onClick={() => handleSelect(s)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                {s}
              </div>
            ))
          ) : (
            <div className="suggestion-item no-match">No matches found</div>
          )}
        </div>
      )}
    </div>
  )
}
