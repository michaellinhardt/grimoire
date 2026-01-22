import type { ReactElement } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Shell } from './core/shell'

function App(): ReactElement {
  return (
    <Tooltip.Provider delayDuration={300}>
      <Shell />
    </Tooltip.Provider>
  )
}

export default App
