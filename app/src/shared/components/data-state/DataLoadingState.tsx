import { AppLoading } from '@/shared/ui/AppLoading'

interface DataLoadingStateProps {
  label?: string
}

export function DataLoadingState({ label = '加载中...' }: DataLoadingStateProps) {
  return (
    <div className="p-6">
      <AppLoading label={label} variant="block" />
    </div>
  )
}
