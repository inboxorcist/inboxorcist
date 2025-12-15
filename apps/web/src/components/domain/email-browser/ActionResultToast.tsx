interface ActionResultToastProps {
  result: {
    success: boolean
    message: string
  }
  onDismiss: () => void
}

export function ActionResultToast({ result, onDismiss }: ActionResultToastProps) {
  return (
    <div
      className={`p-4 rounded-lg ${
        result.success
          ? 'bg-green-500/10 text-green-700 dark:text-green-400'
          : 'bg-red-500/10 text-red-700 dark:text-red-400'
      }`}
    >
      {result.message}
      <button className="ml-2 hover:underline" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  )
}
