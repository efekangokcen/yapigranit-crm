/** Excel/LibreOffice formül enjeksiyonunu ve CSV yapısını bozan girdileri etkisizleştirir. */
export function escapeCsvCell(value: unknown): string {
  if (value == null) return ''
  let text = String(value)
  if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
