export default function ToggleSwitch({ checked, onChange, size = 'md' }) {
  const isMd = size === 'md'
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex items-center flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        isMd ? '' : 'h-6 w-11'
      } ${checked ? 'bg-red-500' : 'bg-gray-200'}`}
      style={isMd ? { width: '52px', height: '28px' } : undefined}
    >
      <span
        className={`inline-block transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
          isMd ? 'h-5 w-5' : 'h-4 w-4'
        } ${
          checked
            ? isMd ? 'translate-x-6' : 'translate-x-5'
            : isMd ? 'translate-x-0.5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
