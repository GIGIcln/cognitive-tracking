import { useAuth } from '../context/AuthContext'

interface Props {
  notes: string | null | undefined
  editing: boolean
  value: string
  saving: boolean
  onChange: (value: string) => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
}

export default function NotesBlock({ notes, editing, value, saving, onChange, onEdit, onSave, onCancel }: Props) {
  const { isAdmin } = useAuth() ?? { isAdmin: false }

  if (editing) {
    return (
      <div className="mt-2">
        <textarea
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Aggiungi note sulla sessione…"
          rows={3}
          className="w-full border border-granata rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-granata resize-none"
        />
        <div className="flex gap-2 mt-1.5">
          <button
            onClick={onCancel}
            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1 border border-gray-200 rounded-lg"
          >
            Annulla
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="text-xs text-white bg-granata hover:bg-granata-dark px-3 py-1 rounded-lg disabled:opacity-60"
          >
            {saving ? 'Salvataggio…' : 'Salva note'}
          </button>
        </div>
      </div>
    )
  }

  if (notes) {
    return (
      <div
        className={`mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap leading-relaxed ${isAdmin ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`}
        onClick={isAdmin ? onEdit : undefined}
        title={isAdmin ? 'Clicca per modificare' : undefined}
      >
        {notes}
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <button
      onClick={onEdit}
      className="mt-2 text-xs text-gray-400 hover:text-granata transition-colors flex items-center gap-1"
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
      Aggiungi note
    </button>
  )
}
