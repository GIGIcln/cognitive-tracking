const CONFIG = {
  disponibile: { label: 'Disponibile', className: 'bg-green-100 text-green-700' },
  limitato:    { label: 'Limitato',    className: 'bg-amber-100 text-amber-700' },
  infortunato: { label: 'Infortunato', className: 'bg-red-100 text-red-700'   },
}

export default function AvailabilityBadge({ availability, className = '' }) {
  if (!availability || availability === 'disponibile') return null
  const { label, className: cls } = CONFIG[availability] ?? CONFIG.disponibile
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls} ${className}`}>
      {label}
    </span>
  )
}
