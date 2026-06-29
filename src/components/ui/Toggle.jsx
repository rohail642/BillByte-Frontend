export default function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between p-3 bg-surface2 rounded-lg">
      <div>
        <p className="text-sm font-semibold text-text">{label}</p>
        {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
      </div>
      <button
        role="switch" aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? 'bg-green' : 'bg-border2'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'left-4' : 'left-0.5'}`} />
      </button>
    </div>
  )
}
