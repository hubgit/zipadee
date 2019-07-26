import React, { useCallback, useEffect, useState } from 'react'
import { Workbox } from 'workbox-window'

export const ServiceWorker: React.FC = React.memo(() => {
  const [workbox, setWorkbox] = useState<Workbox>()

  useEffect(() => {
    const workbox = new Workbox('/service-worker.js')

    workbox.addEventListener('waiting', () => {
      setWorkbox(workbox)
    })

    workbox
      .register()
      .then(() => {
        console.log('Registered ServiceWorker')
      })
      .catch(error => {
        console.error(error)
      })
  }, [])

  const handleReload = useCallback(() => {
    if (workbox) {
      workbox.addEventListener('controlling', () => {
        window.location.reload()
      })

      workbox.messageSW({ type: 'SKIP_WAITING' }).catch(error => {
        console.error(error)
      })
    }
  }, [workbox])

  if (!workbox) {
    return null
  }

  return (
    <button
      className={'button waiting'}
      aria-label={'A new version of the app is available!'}
      data-balloon-pos={'left'}
      onClick={handleReload}
    >
      Update app
    </button>
  )
})
