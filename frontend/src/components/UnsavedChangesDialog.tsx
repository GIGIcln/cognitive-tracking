interface Props {
  onReset: () => void
  onProceed: () => void
}

export default function UnsavedChangesDialog({ onReset, onProceed }: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Modifiche non salvate</h3>
        <p className="text-sm text-gray-600 mb-5">
          Hai dati inseriti che non sono ancora stati salvati. Se esci ora li perderai.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onReset}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50"
          >
            Resta
          </button>
          <button
            onClick={onProceed}
            className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-700"
          >
            Esci senza salvare
          </button>
        </div>
      </div>
    </div>
  )
}
