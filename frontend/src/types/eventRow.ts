export interface EventRow {
  numerator: number
  denominator: number
  method: string
}

export const emptyEventRow = (): EventRow => ({ numerator: 0, denominator: 0, method: 'video' })
