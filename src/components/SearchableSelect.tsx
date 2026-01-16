import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search, Check } from 'lucide-react'

interface Option {
  value: string
  label: string
}

interface SearchableSelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function SearchableSelect({ 
  options, 
  value, 
  onChange, 
  placeholder = 'Seleccionar...', 
  className = '',
  disabled = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(opt => opt.value === value)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const toggleOpen = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
      // Reset search term when opening, or keep it? 
      // Better to clear it so user sees all options initially or previous search?
      // Let's keep previous search if valid, but maybe better to focus input.
      if (!isOpen) {
        // focus input logic is handled by autoFocus on input
      }
    }
  }

  return (
    <div className={`relative ${className}`} ref={wrapperRef}>
      <div
        className={`w-full p-3 bg-sph-light border border-gray-200 rounded-lg flex items-center justify-between transition text-sph-text ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-sph-primary focus:ring-2 focus:ring-sph-primary'
        }`}
        onClick={toggleOpen}
      >
        <span className={`truncate ${!selectedOption ? 'text-gray-500' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-sph-light rounded-md px-2 border border-transparent focus-within:border-sph-primary transition-colors">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                className="w-full p-2 bg-transparent outline-none text-sm text-sph-text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          
          <div className="overflow-y-auto flex-1">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center">No se encontraron resultados</div>
            ) : (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  className={`p-3 text-sm cursor-pointer hover:bg-sph-light flex items-center justify-between border-b border-gray-50 last:border-0 ${
                    value === opt.value ? 'bg-blue-50 text-sph-primary font-medium' : 'text-sph-text'
                  }`}
                  onClick={() => {
                    onChange(opt.value)
                    setIsOpen(false)
                    setSearchTerm('')
                  }}
                >
                  <span className="truncate">{opt.label}</span>
                  {value === opt.value && <Check className="w-4 h-4 shrink-0" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
