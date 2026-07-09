/**
 * Formats a decimal duration of hours into a human-readable format like "8h 15m".
 * Under no circumstances will it display negative hours (defensively bounded to 0).
 */
export function formatHours(hours: number | null | undefined): string {
  if (hours == null || isNaN(hours)) return '0h'
  
  const positiveHours = Math.max(0, hours)
  const h = Math.floor(positiveHours)
  const m = Math.round((positiveHours - h) * 60)
  
  if (m === 60) {
    return `${h + 1}h`
  }
  
  if (m === 0) return `${h}h`
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

/**
 * Formats a decimal variance of hours into a signed human-readable string like "+2h 30m" or "-1h 15m".
 */
export function formatVariance(hours: number | null | undefined): string {
  if (hours == null || isNaN(hours)) return '0h'
  if (hours < 0) {
    return `-${formatHours(Math.abs(hours))}`
  }
  if (hours > 0) {
    return `+${formatHours(hours)}`
  }
  return '0h'
}

