export function formatDateShort(d: string | Date): string {
  return new Date(d).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

export function formatDateLong(d: string | Date | null | undefined): string {
  return d
    ? new Date(d).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : ''
}
