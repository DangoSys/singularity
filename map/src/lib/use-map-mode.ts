import { useRef } from 'react'
import { useStore as useRfStore } from '@xyflow/react'

export type ZoomTier = 'work' | 'map' | 'glyph'

export function useZoomTier(): ZoomTier {
  const ref = useRef<ZoomTier>('work')
  return useRfStore((s) => {
    const z = s.transform[2]
    const cur = ref.current
    if (cur === 'work') {
      if (z <= 0.8) ref.current = z <= 0.32 ? 'glyph' : 'map'
    } else if (cur === 'map') {
      if (z >= 0.9) ref.current = 'work'
      else if (z <= 0.32) ref.current = 'glyph'
    } else {
      if (z >= 0.9) ref.current = 'work'
      else if (z >= 0.4) ref.current = 'map'
    }
    return ref.current
  })
}
