export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "-"
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}
