import type { useFeishuCliSettings } from '../hooks/useFeishuCliSettings'
import { FeishuCliAppCard } from './feishuCli/FeishuCliAppCard'
import { FeishuCliDiagCard } from './feishuCli/FeishuCliDiagCard'
import { FeishuCliErrorBanner } from './feishuCli/FeishuCliErrorBanner'
import { FeishuCliScopesGrid } from './feishuCli/FeishuCliScopesGrid'
import { FeishuCliScopesHeader } from './feishuCli/FeishuCliScopesHeader'
import { FeishuCliScopesWarningsAndUrl } from './feishuCli/FeishuCliScopesWarningsAndUrl'
import { FeishuCliStatusCards } from './feishuCli/FeishuCliStatusCards'
import { FeishuCliTopBar } from './feishuCli/FeishuCliTopBar'

export type FeishuCliPanelProps = ReturnType<typeof useFeishuCliSettings>

export function FeishuCliPanel(props: FeishuCliPanelProps) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="bg-white/86 backdrop-blur-xl rounded-[22px] border border-[var(--color-border)] p-5 shadow-[0_24px_64px_rgba(15,23,42,0.10)]">
        <FeishuCliTopBar
          feishuConnectionLabel={props.feishuConnectionLabel}
          feishuStatusLoading={props.feishuStatusLoading}
          loadFeishuStatus={props.loadFeishuStatus}
        />
        <FeishuCliStatusCards
          feishuHealth={props.feishuHealth}
          feishuConfigured={props.feishuConfigured}
          feishuAuthenticated={props.feishuAuthenticated}
        />
        <FeishuCliErrorBanner feishuStatusError={props.feishuStatusError} feishuHealth={props.feishuHealth} />
        <div className="mt-5 space-y-4">
          <FeishuCliAppCard
            feishuConfigured={props.feishuConfigured}
            showFeishuConfigForm={props.showFeishuConfigForm}
            feishuAppId={props.feishuAppId}
            setFeishuAppId={props.setFeishuAppId}
            feishuAppSecret={props.feishuAppSecret}
            setFeishuAppSecret={props.setFeishuAppSecret}
            setFeishuConfigEditing={props.setFeishuConfigEditing}
            feishuSetupLoading={props.feishuSetupLoading}
            handleFeishuConfigInit={props.handleFeishuConfigInit}
            handleFeishuConfigRemove={props.handleFeishuConfigRemove}
          />
          <div className="rounded-[18px] border border-slate-200 bg-white p-4">
            <FeishuCliScopesHeader
              selectedFeishuDomainLabels={props.selectedFeishuDomainLabels}
              feishuConfigured={props.feishuConfigured}
              feishuAuthLoading={props.feishuAuthLoading}
              feishuAuthDomains={props.feishuAuthDomains}
              handleFeishuAuthSync={props.handleFeishuAuthSync}
            />
            <FeishuCliScopesGrid
              feishuDomains={props.feishuDomains}
              feishuAuthDomains={props.feishuAuthDomains}
              feishuAuthLoading={props.feishuAuthLoading}
              handleFeishuAuthDomainToggle={props.handleFeishuAuthDomainToggle}
            />
            <FeishuCliScopesWarningsAndUrl
              feishuAuthDirty={props.feishuAuthDirty}
              feishuDomainSelectionChanged={props.feishuDomainSelectionChanged}
              feishuPendingUrl={props.feishuPendingUrl}
              feishuAuthLoading={props.feishuAuthLoading}
              feishuAuthPayload={props.feishuAuthPayload}
              handleCopyFeishuUrl={props.handleCopyFeishuUrl}
              handleFeishuAuthComplete={props.handleFeishuAuthComplete}
            />
          </div>
          <FeishuCliDiagCard
            feishuHealth={props.feishuHealth}
            feishuScopeCatalog={props.feishuScopeCatalog}
            feishuAuthStatus={props.feishuAuthStatus}
            feishuDiagnosticsOpen={props.feishuDiagnosticsOpen}
            setFeishuDiagnosticsOpen={props.setFeishuDiagnosticsOpen}
          />
        </div>
      </div>
    </div>
  )
}
