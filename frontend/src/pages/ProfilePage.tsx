import { useAuth } from '../context/AuthContext'

const roleLabel = (role: string) =>
  ({ admin: 'Admin', responsabile_tecnico: 'Responsabile tecnico', allenatore: 'Allenatore' }[role] ?? role)

export default function ProfilePage() {
  const { user } = useAuth()

  return (
    <div className="max-w-md">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Profilo</h2>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-4 py-3">
          <div className="text-xs text-gray-400 mb-0.5">Nome</div>
          <div className="text-sm font-medium text-gray-900">{user?.full_name || '—'}</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-xs text-gray-400 mb-0.5">Email</div>
          <div className="text-sm text-gray-900">{user?.email}</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-xs text-gray-400 mb-0.5">Ruoli</div>
          <div className="flex flex-wrap gap-1 mt-1">
            {user?.roles?.map((r) => (
              <span key={r} className="text-xs bg-granata/10 text-granata px-2 py-0.5 rounded-full">
                {roleLabel(r)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
