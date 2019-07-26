import JSZip from 'jszip'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { GitHubLink } from './GitHubLink'
import { ServiceWorker } from './ServiceWorker'

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>

  prompt(): Promise<void>
}

export const Nav: React.FC<{
  changed: boolean
  file?: File
  filename?: string
  handleReset: () => void
  setChanged: (changed: boolean) => void
  setError: (error: string) => void
  setFilename: (filename: string) => void
  zip?: JSZip
}> = React.memo(
  ({
    changed,
    file,
    filename,
    handleReset,
    setChanged,
    setError,
    setFilename,
    zip,
  }) => {
    const [installPrompt, setInstallPrompt] = useState<
      BeforeInstallPromptEvent
    >()

    // download the updated zip
    const downloadZip = useCallback(() => {
      if (zip && filename) {
        zip
          .generateAsync({
            type: 'blob',
          })
          .then(blob => {
            saveAs(blob, filename)
            setChanged(false)
          })
          .catch(error => {
            setError(error.message)
          })
      }
    }, [zip, filename, setChanged, setError])

    // prompt the user to install the app when appropriate
    useEffect(() => {
      const listener = (event: Event) => {
        setInstallPrompt(() => event as BeforeInstallPromptEvent)
      }

      window.addEventListener('beforeinstallprompt', listener)

      return () => {
        window.removeEventListener('beforeinstallprompt', listener)
      }
    }, [])

    // show the install prompt when the install button is clicked
    const showInstallPrompt = useCallback(() => {
      if (installPrompt) {
        installPrompt.prompt()

        installPrompt.userChoice
          .then(choiceResult => {
            console.log(`Install ${choiceResult}`)
          })
          .catch(error => {
            setError(error.message)
          })
      }
    }, [installPrompt, setError])

    const filenameRef = useRef<HTMLInputElement>(null)

    // handle edits to the file name
    const handleFilenameChange = useCallback(
      event => {
        setFilename(event.target.value)
        setChanged(true)
      },
      [setChanged, setFilename]
    )

    // handle submission of the file name form
    const handleFilenameSubmit = useCallback(
      (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (filenameRef.current) {
          filenameRef.current.blur()
        }
      },
      [filenameRef]
    )

    return (
      <nav className={'header'}>
        <div className={'header-section'}>
          <button
            onClick={handleReset}
            className={'reset'}
            aria-label={file ? 'Choose a new file' : undefined}
            data-balloon-pos={'right'}
          >
            <img className={'logo'} src={'/favicon.ico'} alt={'Zipadee logo'} />
          </button>

          {filename && (
            <form
              className={'filename-form'}
              onSubmit={handleFilenameSubmit}
              aria-label={'Rename the file'}
              data-balloon-pos={'right'}
            >
              <input
                ref={filenameRef}
                onChange={handleFilenameChange}
                className={'filename-input'}
                value={filename}
                size={filename.length}
              />
            </form>
          )}
        </div>

        {filename && (
          <div className={'header-section'}>
            {changed && (
              <div
                className={'button download'}
                onClick={downloadZip}
                aria-label={`Download ${filename}`}
                data-balloon-pos={'left'}
              >
                Save updated file
              </div>
            )}

            {process.env.NODE_ENV === 'production' && <ServiceWorker />}

            {installPrompt && (
              <button className={'button install'} onClick={showInstallPrompt}>
                Install
              </button>
            )}

            <GitHubLink repo={'hubgit/zipadee'} />
          </div>
        )}
      </nav>
    )
  }
)
