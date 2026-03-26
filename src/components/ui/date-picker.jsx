import { useState, useEffect } from "react"
import { Button } from "./button"
import { Input } from "./input"
import { Calendar } from "./calendar"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { CalendarIcon } from "lucide-react"
import { format, parse, isValid } from "date-fns"

export function DatePicker({
  value,
  onChange,
  placeholder = "MM/DD/YYYY",
  className = "",
  disablePast = false,
  disableFuture = false
}) {
  const [inputValue, setInputValue] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Keep input synced with prop
  useEffect(() => {
    if (value) {
      setInputValue(format(value, "MM/dd/yyyy"))
    } else {
      setInputValue("")
    }
  }, [value])

  const parseManualInput = (input) => {
    const cleanInput = input.trim()
    const dateRegex = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/
    const match = cleanInput.match(dateRegex)
    if (!match) return null

    const [, month, day, year] = match
    try {
      const parsed = parse(`${month}/${day}/${year}`, "M/d/yyyy", new Date())
      return isValid(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  const handleInputChange = (e) => {
    const newVal = e.target.value
    setInputValue(newVal)
    if (newVal === "") {
      onChange(undefined)
      return
    }
    const parsed = parseManualInput(newVal)
    if (parsed) onChange(parsed)
  }

  const handleInputBlur = () => {
    if (inputValue && value) {
      setInputValue(format(value, "MM/dd/yyyy"))
    }
  }

  const handleCalendarSelect = (date) => {
    if (date) {
      const selected = new Date(date)
      selected.setHours(0, 0, 0, 0)
      if (disablePast && selected < today) return
      if (disableFuture && selected > today) return
    }
    onChange(date)
    setInputValue(date ? format(date, "MM/dd/yyyy") : "")
    setIsOpen(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter") e.currentTarget.blur()
  }

  return (
    <div className={`relative ${className}`}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center">
          <Input
            type="text"
            placeholder={placeholder}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            className="text-sm pr-10"
          />
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-accent"
              onClick={() => setIsOpen(!isOpen)}
            >
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
        </div>

        <PopoverContent
          align="start"
          sideOffset={4}
          className="p-0 w-auto rounded-md shadow-md border bg-background"
        >
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleCalendarSelect}
            showOutsideDays
            disabled={(date) => {
              const check = new Date(date)
              check.setHours(0, 0, 0, 0)
              if (disablePast && check < today) return true
              if (disableFuture && check > today) return true
              return false
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
