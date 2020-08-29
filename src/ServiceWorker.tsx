import React, { useCallback, useEffect, useState } from 'react'
import { Workbox } from 'workbox-window'

export const ServiceWorker: React.FC<{ file?: File }> = React.memo(
  ({ file }) => {
    const [workbox, setWorkbox] = useState<Workbox>()
    const [registration, setRegistration] = useState<
      ServiceWorkerRegistration
    >()

    useEffect(() => {
      const workbox = new Workbox('/service-worker.js')

      workbox.addEventListener('waiting', () => {
        setWorkbox(workbox)
      })

      workbox
        .register()
        .then((registration) => {
          setRegistration(registration)
        })
        .catch((error) => {
          console.error(error)
        })
    }, [])

    useEffect(() => {
      if (file && registration) {
        registration.update().catch((error) => {
          console.error(error)
        })
      }
    }, [file, registration])

    const handleReload = useCallback(() => {
      if (workbox) {
        workbox.addEventListener('controlling', () => {
          window.location.reload()
        })

        workbox.messageSW({ type: 'SKIP_WAITING' }).catch((error) => {
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
  }
)
