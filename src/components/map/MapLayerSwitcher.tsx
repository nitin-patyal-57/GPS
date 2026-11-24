import { useState, useRef, useEffect } from 'react'
import { Layers, ChevronDown } from 'lucide-react'
import { MAP_LAYERS, type MapLayerType } from './mapLayers'

interface MapLayerSwitcherProps {
  currentLayer: MapLayerType
  onSelectLayer: (layer: MapLayerType) => void
}

export function MapLayerSwitcher({ currentLayer, onSelectLayer }: MapLayerSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const activeConfig = MAP_LAYERS[currentLayer] || MAP_LAYERS['google-streets']

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative pointer-events-auto" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl bg-slate-900/90 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md border border-slate-700/60 hover:bg-slate-800 transition"
      >
        <Layers className="h-3.5 w-3.5 text-emerald-400" />
        <span className="hidden sm:inline">{activeConfig.icon} {activeConfig.shortName}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xl bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-md border border-slate-700/80 z-[2000] space-y-1">
          <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
            Map Provider
          </div>
          {Object.values(MAP_LAYERS).map((layer) => {
            const isSelected = layer.id === currentLayer
            return (
              <button
                key={layer.id}
                onClick={() => {
                  onSelectLayer(layer.id)
                  setIsOpen(false)
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                  isSelected
                    ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="text-base">{layer.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate leading-none">{layer.name}</p>
                </div>
                {isSelected && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
