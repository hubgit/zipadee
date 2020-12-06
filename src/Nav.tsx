import { fileOpen, fileSave, FileSystemHandle } from 'browser-nativefs'
import JSZip from 'jszip'
import * as monaco from 'monaco-editor'
// import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { InfoLink } from './InfoLink'
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
  editor?: monaco.editor.IStandaloneCodeEditor
  file?: File
  filename?: string
  handleReset: () => void
  setChanged: (changed: boolean) => void
  setError: (error: string) => void
  setFile: (file: File) => void
  setFilename: (filename: string) => void
  zip?: JSZip
}> = React.memo(
  ({
    changed,
    // editor,
    file,
    filename,
    handleReset,
    setChanged,
    setError,
    setFile,
    setFilename,
    zip,
  }) => {
    const [
      installPrompt,
      setInstallPrompt,
    ] = useState<BeforeInstallPromptEvent>()

    // download the updated zip
    const downloadZip = useCallback(async () => {
      if (zip && file) {
        try {
          const blob = await zip.generateAsync({
            type: 'blob',
          })

          try {
            await fileSave(
              blob,
              {
                fileName: filename,
                extensions: ['.zip'], // TODO: add extension
              },
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              file.name === filename ? file.handle : undefined
            )
          } catch (error) {
            await fileSave(blob, {
              fileName: filename,
              extensions: ['.zip'],
            })
          }

          setChanged(false)
        } catch (error) {
          setError(error.message)
        }
      }
    }, [zip, file, filename, setChanged, setError])

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
    const showInstallPrompt = useCallback(async () => {
      if (installPrompt) {
        await installPrompt.prompt()

        installPrompt.userChoice
          .then((choiceResult) => {
            console.log(`Install ${choiceResult}`)
          })
          .catch((error) => {
            setError(error.message)
          })
      }
    }, [installPrompt, setError])

    const filenameRef = useRef<HTMLInputElement>(null)

    // handle edits to the file name
    const handleFilenameChange = useCallback(
      (event) => {
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

    const handleOpen = useCallback(() => {
      fileOpen()
        .then(async (file) => {
          setFile(file)
          setFilename(file.name)
        })
        .catch((error) => {
          setError(error)
        })
    }, [setError, setFile, setFilename])

    return (
      <nav className={'nav'}>
        <div className={'nav-group header-section-file'}>
          <img className={'logo'} src={'/favicon.ico'} alt={'Zipadee logo'} />

          {!filename && <span className={'brand'}>Zipadee</span>}

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

        <div className={'nav-group header-section-buttons'}>
          {changed && filename && (
            <div
              className={'button download'}
              onClick={downloadZip}
              aria-label={`Download ${filename}`}
              data-balloon-pos={'left'}
            >
              Save updated file
            </div>
          )}

          {process.env.NODE_ENV === 'production' && (
            <ServiceWorker file={file} />
          )}

          {installPrompt && (
            <button className={'button install'} onClick={showInstallPrompt}>
              Install
            </button>
          )}

          {file && (
            <button
              className={'button reset'}
              onClick={handleReset}
              aria-label={'Choose a new file'}
              data-balloon-pos={'left'}
            >
              ✕
            </button>
          )}

          {!file && (
            <button
              className={'button'}
              onClick={handleOpen}
              aria-label={'Open a ZIP file'}
              data-balloon-pos={'left'}
            >
              Open File
            </button>
          )}

          {!file && (
            <InfoLink
              href={'https://github.com/hubgit/zipadee'}
              title={'View source on GitHub'}
            />
          )}
        </div>
      </nav>
    )
  }
)
