"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface DateSelection {
  checkIn: Date | null;
  checkOut: Date | null;
}

function buildBlockedDates(bookedRanges: DateRange[]): Set<string> {
  const blocked = new Set<string>();
  for (const range of bookedRanges) {
    // check_out day itself is NOT blocked — a new guest may check in the
    // same day the previous guest checks out.
    const days = eachDayOfInterval({ start: range.start, end: addDays(range.end, -1) });
    for (const day of days) blocked.add(format(day, "yyyy-MM-dd"));
  }
  return blocked;
}

function rangeHasBlockedDate(start: Date, end: Date, blocked: Set<string>) {
  const days = eachDayOfInterval({ start, end: addDays(end, -1) });
  return days.some((d) => blocked.has(format(d, "yyyy-MM-dd")));
}

export default function BookingCalendar({
  bookedRanges,
  selection,
  onChange,
  monthsToShow = 2,
}: {
  bookedRanges: DateRange[];
  selection: DateSelection;
  onChange: (selection: DateSelection) => void;
  monthsToShow?: number;
}) {
  const today = startOfDay(new Date());
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(today));
  const blocked = useMemo(() => buildBlockedDates(bookedRanges), [bookedRanges]);

  function isDisabled(day: Date) {
    if (isBefore(day, today)) return true;
    return blocked.has(format(day, "yyyy-MM-dd"));
  }

  function handleDayClick(day: Date) {
    if (isDisabled(day)) return;

    const { checkIn, checkOut } = selection;

    if (!checkIn || checkOut) {
      onChange({ checkIn: day, checkOut: null });
      return;
    }

    if (isSameDay(day, checkIn) || isBefore(day, checkIn)) {
      onChange({ checkIn: day, checkOut: null });
      return;
    }

    if (rangeHasBlockedDate(checkIn, day, blocked)) {
      onChange({ checkIn: day, checkOut: null });
      return;
    }

    onChange({ checkIn, checkOut: day });
  }

  const months = Array.from({ length: monthsToShow }, (_, i) =>
    addMonths(visibleMonth, i),
  );

  return (
    <div>
      <div className="flex items-center justify-between pb-4">
        <button
          type="button"
          onClick={() => setVisibleMonth((m) => addMonths(m, -1))}
          disabled={isSameMonth(visibleMonth, today)}
          aria-label="Previous month"
          className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-gold-500/25 text-ink disabled:cursor-not-allowed disabled:opacity-30"
        >
          <CaretLeft size={16} />
        </button>
        <p className="text-sm font-semibold text-ink">
          {format(visibleMonth, "MMMM yyyy")}
        </p>
        <button
          type="button"
          onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
          aria-label="Next month"
          className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-gold-500/25 text-ink"
        >
          <CaretRight size={16} />
        </button>
      </div>

      <div className={`grid gap-6 ${monthsToShow > 1 ? "sm:grid-cols-2" : ""}`}>
        {months.map((month) => (
          <MonthGrid
            key={month.toISOString()}
            month={month}
            today={today}
            selection={selection}
            isDisabled={isDisabled}
            onDayClick={handleDayClick}
          />
        ))}
      </div>
    </div>
  );
}

function MonthGrid({
  month,
  today,
  selection,
  isDisabled,
  onDayClick,
}: {
  month: Date;
  today: Date;
  selection: DateSelection;
  isDisabled: (day: Date) => boolean;
  onDayClick: (day: Date) => void;
}) {
  const start = startOfWeek(startOfMonth(month));
  const end = addDays(startOfWeek(endOfMonth(month)), 6);
  const days = eachDayOfInterval({ start, end });
  const { checkIn, checkOut } = selection;

  return (
    <div>
      {month.getMonth() !== startOfMonth(today).getMonth() && (
        <p className="mb-2 text-center text-xs font-medium text-ink/65 sm:hidden">
          {format(month, "MMMM yyyy")}
        </p>
      )}
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-ink/65">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const disabled = isDisabled(day);
          const isCheckIn = checkIn && isSameDay(day, checkIn);
          const isCheckOut = checkOut && isSameDay(day, checkOut);
          const inRange =
            checkIn &&
            checkOut &&
            isWithinInterval(day, { start: checkIn, end: checkOut }) &&
            !isCheckIn &&
            !isCheckOut;

          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={disabled || !inMonth}
              onClick={() => onDayClick(day)}
              aria-label={format(day, "PPPP")}
              aria-pressed={Boolean(isCheckIn || isCheckOut)}
              className={[
                "focus-ring flex h-9 w-full items-center justify-center rounded-full text-sm transition-colors",
                !inMonth ? "invisible" : "",
                disabled && inMonth
                  ? "cursor-not-allowed text-ink/30 line-through"
                  : "",
                !disabled && inMonth && !isCheckIn && !isCheckOut && !inRange
                  ? "text-ink/80 hover:bg-surface"
                  : "",
                inRange ? "bg-terracotta-100 text-terracotta-700 dark:bg-terracotta-700/25 dark:text-terracotta-300" : "",
                isCheckIn || isCheckOut
                  ? "bg-terracotta-500 font-semibold text-white"
                  : "",
              ].join(" ")}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
