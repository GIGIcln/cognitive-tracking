export function formatDateShort(d) {
  return new Date(d).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

export function formatDateLong(d) {
  return d
    ? new Date(d).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : ''
}
