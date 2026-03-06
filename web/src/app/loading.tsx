export default function GlobalLoading() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1">
      <div className="route-progress-track">
        <div className="route-progress-bar" data-testid="route-top-progress" />
      </div>
    </div>
  )
}

