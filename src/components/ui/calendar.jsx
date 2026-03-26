"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "./utils"
import { buttonVariants } from "./button"

function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        "p-4 sm:p-6 w-full max-w-[420px] sm:max-w-[460px] mx-auto",
        className
      )}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4 justify-center",
        month: "flex flex-col gap-4 w-full",
        caption: "flex justify-between items-center w-full px-2",
        caption_label: "text-base font-semibold text-center flex-1",
        nav: "flex items-center gap-2",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100"
        ),
        table: "w-full border-separate border-spacing-x-4 border-spacing-y-2",
        head_row: "",
        head_cell: "text-muted-foreground rounded-md text-center text-sm sm:text-base font-medium w-[48px] sm:w-[52px]",
        row: "",
        cell: "text-center text-sm sm:text-base p-0 relative w-[48px] sm:w-[52px] [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 sm:h-10 sm:w-10 p-0 mx-auto font-normal aria-selected:opacity-100"
        ),
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary/90 aria-selected:opacity-100",
        day_today:
          "bg-accent/50 text-accent-foreground hover:bg-accent",
        day_outside: "text-muted-foreground opacity-50",
        day_disabled: "text-muted-foreground opacity-50 pointer-events-none",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",

        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("size-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("size-4", className)} {...props} />
        ),
      }}
      {...props}
    />
  )
}

export { Calendar }
