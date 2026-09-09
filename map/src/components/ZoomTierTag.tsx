import { useEffect } from 'react'
import { useStore as useRfStore } from '@xyflow/react'
import { useZoomTier } from '../lib/use-map-mode'

export function ZoomTierTag() {
  const tier = useZoomTier()
  const zoom = useRfStore((s) => s.transform[2])
  useEffect(() => {
    const el = document.querySelector('.react-flow')
    if (el === null) throw new Error('ZoomTierTag: react-flow missing')
    el.setAttribute('data-zoom-tier', tier)
  }, [tier])
  useEffect(() => {
    document.documentElement.style.setProperty('--sg-zoom', String(zoom))
  }, [zoom])
  return null
}
