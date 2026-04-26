interface DataErrorStateProps {
  message: string
  onRetry?: () => void
}

export function DataErrorState({ message, onRetry }: DataErrorStateProps) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-body text-amber-800">
      <div>{message}</div>
      {onRetry ? (
        <button type="button" className="btn btn-sm mt-3" onClick={onRetry}>
          重试
        </button>
      ) : null}
    </section>
  )
}
