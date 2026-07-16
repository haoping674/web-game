import type { NetworkNotice } from '../hooks/useNetworkStatus'

type NetworkStatusToastProps = { notice: NetworkNotice; inline?: boolean }

export function NetworkStatusToast({ notice, inline = false }: NetworkStatusToastProps) {
  if (!notice) return null
  const restored = notice === 'restored'
  const message = restored
    ? '\u5df2\u6062\u5fa9\u9023\u7dda\uff0c\u7dda\u4e0a\u529f\u80fd\u53ef\u518d\u6b21\u4f7f\u7528\u3002'
    : '\u76ee\u524d\u96e2\u7dda\uff1b\u5df2\u4e0b\u8f09\u7684\u904a\u6232\u8207\u672c\u6a5f\u7d00\u9304\u4ecd\u53ef\u4f7f\u7528\uff0c\u90e8\u5206\u5916\u90e8\u529f\u80fd\u53ef\u80fd\u4e0d\u53ef\u7528\u3002'
  return <div className={`network-toast${restored ? ' is-restored' : ''}${inline ? ' is-inline' : ''}`} role="status" aria-live="polite">{message}</div>
}
