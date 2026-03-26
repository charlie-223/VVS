import { useState, useEffect } from "react"
import { LogOut } from "lucide-react"
import { Button } from "./ui/button"

export function Header({ currentUser, onLogout }) {
  const [currentDateTime, setCurrentDateTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatDate = date => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    })
  }

  const formatTime = date => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    })
  }

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-end items-center">
      <div className="flex items-center gap-6">
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900">
            {formatDate(currentDateTime)}
          </div>
          <div className="text-sm text-gray-500">
            {formatTime(currentDateTime)}
          </div>
        </div>
        <Button
          variant="destructive"
          size="sm"
          className="bg-red-600 hover:bg-red-700"
          onClick={onLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  )
}
