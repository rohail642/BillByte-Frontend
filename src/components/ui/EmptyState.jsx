export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="w-full flex flex-col items-center justify-center py-16 text-center gap-3">
      {icon && <div className="text-muted opacity-60 [&_svg]:w-10 [&_svg]:h-10 [&_svg]:stroke-[1.5]">{icon}</div>}
      <div>
        <p className="font-display font-bold text-text2">{title}</p>
        {description && <p className="text-sm text-muted mt-1">{description}</p>}
      </div>
      {action}
    </div>
  )
}