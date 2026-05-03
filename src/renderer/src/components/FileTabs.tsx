import React from 'react'
import { X, FileText } from 'lucide-react'
import { FileTab } from '../types'

interface FileTabsProps {
  tabs: FileTab[]
  activeId: string | null
  onTabSelect: (id: string) => void
  onTabClose: (id: string, e: React.MouseEvent) => void
}

export default function FileTabs({ tabs, activeId, onTabSelect, onTabClose }: FileTabsProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY
    }
  }

  if (tabs.length === 0) return null

  return (
    <div className="file-tabs-container">
      <div 
        className="file-tabs-scroll" 
        ref={scrollRef}
        onWheel={handleWheel}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`file-tab ${tab.id === activeId ? 'active' : ''} ${tab.processing ? 'processing' : ''}`}
            onClick={() => onTabSelect(tab.id)}
            title={tab.name}
          >
            <div className="file-tab-content">
              <FileText size={14} className="file-tab-icon" />
              <span className="file-tab-name">{tab.name}</span>
              {tab.processing && <div className="file-tab-spinner" />}
            </div>
            <button 
              className="file-tab-close" 
              onClick={(e) => onTabClose(tab.id, e)}
              aria-label="Close tab"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
