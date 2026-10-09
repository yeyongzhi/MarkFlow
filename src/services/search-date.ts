export function inCreationRange(createdAt: number | null | undefined, start: string, end: string) {
  if (start && end && start > end) return false
  if (!start && !end) return true
  if (createdAt == null || !Number.isFinite(createdAt)) return false
  const day = new Date(createdAt)
  const date = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`
  return (!start || date >= start) && (!end || date <= end)
}
