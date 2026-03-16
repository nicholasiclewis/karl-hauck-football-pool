/**
 * Reusable section header that sits below the TopNav on each page.
 * Props:
 *   title    — main heading
 *   subtitle — smaller line below (optional)
 *   action   — a button/element to show on the right (optional)
 */
export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="px-4 pt-4 pb-3 border-b border-border">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-text leading-tight">{title}</h2>
          {subtitle && (
            <p className="text-xs text-muted mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  )
}
