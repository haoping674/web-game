import { useState } from 'react'
import { usePwaUpdate } from '../hooks/usePwaUpdate'
import { PwaUpdateDialog } from './PwaUpdateDialog'

type PwaUpdateNoticeProps = {
  isGameActive: boolean
}

export function PwaUpdateNotice({ isGameActive }: PwaUpdateNoticeProps) {
  const [deferUpdate, setDeferUpdate] = useState(false)
  const pwaUpdate = usePwaUpdate()

  return (
    <PwaUpdateDialog
      visible={pwaUpdate.updateAvailable && !deferUpdate}
      isGameActive={isGameActive}
      onUpdate={pwaUpdate.applyUpdate}
      onLater={() => setDeferUpdate(true)}
    />
  )
}
