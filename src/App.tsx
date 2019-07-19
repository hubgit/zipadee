import classnames from 'classnames'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import './App.css'
import { Files } from './Files'

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>

  prompt(): Promise<void>
}

const chooseLanguage = (filename: string) => {
  if (filename.endsWith('-json')) {
    return 'json'
  }

  return undefined
}

export const App: React.FC = () => {
  const [error, setError] = useState<string>()
  const [file, setFile] = useState<File>()
  const [zip, setZip] = useState<JSZip>()
  const [files, setFiles] = useState<string[]>()
  const [selectedFilename, setSelectedFilename] = useState<string>()
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor>()
  const [changed, setChanged] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent>()

  // reset
  const handleReset = useCallback(() => {
    setError(undefined)
    setFile(undefined)
    setZip(undefined)
    setFiles(undefined)
    setSelectedFilename(undefined)
    setChanged(false)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    onDrop: acceptedFiles => {
      if (editor) {
        const prevModel = editor.getModel()

        if (prevModel) {
          prevModel.dispose()
        }
      }

      if (acceptedFiles.length) {
        setFile(acceptedFiles[0])
      } else {
        setError('This file type is not acceptable')
      }
    },
  })

  // read file list from the zip
  useEffect(() => {
    if (file)
      import(/* webpackPrefetch: true */ 'jszip')
        .then(JSZip => JSZip.loadAsync(file))
        .then(zip => {
          setZip(zip)

          const files: string[] = []

          for (const zipEntry of Object.values(zip.files)) {
            if (!zipEntry.dir) {
              files.push(zipEntry.name)
            }
          }

          files.sort()

          setFiles(files)
        })
        .catch(error => {
          if (file.name.endsWith('.zip')) {
            setError(error.message)
          } else {
            setError(`This is not a ZIP file 😖`)
          }
        })
  }, [file])

  // download the updated zip
  const downloadZip = useCallback(() => {
    if (zip && file) {
      zip
        .generateAsync({
          type: 'blob',
        })
        .then(blob => {
          saveAs(blob, file.name)
        })
        .catch(error => {
          setError(error.message)
        })
    }
  }, [zip, file])

  const editorRef = useRef<HTMLDivElement>(null)

  // open the selected file in the editor
  const selectFile = useCallback(
    (filename: string) => {
      if (zip) {
        setSelectedFilename(filename)

        zip
          .file(filename)
          .async('text')
          .then(async code => {
            let existingEditor = editor

            if (!existingEditor) {
              if (!editorRef.current) {
                throw new Error('Editor node not mounted')
              }

              const theme = await import('monaco-themes/themes/GitHub.json')

              monaco.editor.defineTheme(
                'github',
                theme as monaco.editor.IStandaloneThemeData
              )

              const editor = monaco.editor.create(editorRef.current, {
                wordWrap: 'on',
                theme: 'github',
              })

              setEditor(editor)

              existingEditor = editor
            }

            const prevModel = existingEditor.getModel()

            if (prevModel) {
              prevModel.dispose()
            }

            const monacoEditor = await import(
              // eslint-disable-next-line import/no-unresolved
              /* webpackPrefetch: true */ 'monaco-editor'
            )

            const model = monacoEditor.editor.createModel(
              code,
              chooseLanguage(filename),
              monacoEditor.Uri.file(filename)
            )

            existingEditor.setModel(model)

            existingEditor.focus()
          })
          .catch(error => {
            setError(error.message)
          })
      }
    },
    [zip, editor]
  )

  // download an individual file
  const downloadSelectedFile = useCallback(() => {
    if (zip && selectedFilename) {
      zip
        .file(selectedFilename)
        .async('blob')
        .then(blob => {
          saveAs(blob, selectedFilename)
        })
        .catch(error => {
          setError(error.message)
        })
    }
  }, [zip, selectedFilename])

  // write the updated data to the file
  useEffect(() => {
    let disposable: monaco.IDisposable | undefined

    if (editor && zip && selectedFilename) {
      disposable = editor.onDidChangeModelContent(() => {
        zip.file(selectedFilename, editor.getValue())
        setChanged(true)
      })
    }

    return () => {
      if (disposable) {
        disposable.dispose()
      }
    }
  }, [editor, zip, selectedFilename])

  useEffect(() => {
    const listener = (event: Event) => {
      setInstallPrompt(() => event as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', listener)

    return () => {
      window.removeEventListener('beforeinstallprompt', listener)
    }
  }, [])

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
  }, [installPrompt])

  return (
    <nav
      className={classnames({
        container: true,
        fullscreen: !file,
      })}
    >
      <nav className={'header'}>
        <div className={'header-section'}>
          <button onClick={handleReset} className={'reset'}>
            <img className={'logo'} src={'/favicon.ico'} alt={'Zipadee logo'} />
          </button>

          {file && (
            <div className={'zipfile'}>
              <span>{file.name}</span>
            </div>
          )}
        </div>

        {file && (
          <div className={'header-section'}>
            {installPrompt && (
              <button className={'install'} onClick={showInstallPrompt}>
                Install
              </button>
            )}

            <a
              className={'github-link'}
              href={`https://github.com/hubgit/zipadee/`}
              target={'_blank'}
              rel={'noopener noreferrer'}
            >
              <svg
                width={24}
                height={24}
                viewBox={'12 12 40 40'}
                className={'github-icon'}
              >
                <path
                  fill={'currentColor'}
                  d={
                    'M32 13.4c-10.5 0-19 8.5-19 19 0 8.4 5.5 15.5 13 18 1 .2 1.3-.4 1.3-.9v-3.2c-5.3 1.1-6.4-2.6-6.4-2.6-.9-2.1-2.1-2.7-2.1-2.7-1.7-1.2.1-1.1.1-1.1 1.9.1 2.9 2 2.9 2 1.7 2.9 4.5 2.1 5.5 1.6.2-1.2.7-2.1 1.2-2.6-4.2-.5-8.7-2.1-8.7-9.4 0-2.1.7-3.7 2-5.1-.2-.5-.8-2.4.2-5 0 0 1.6-.5 5.2 2 1.5-.4 3.1-.7 4.8-.7 1.6 0 3.3.2 4.7.7 3.6-2.4 5.2-2 5.2-2 1 2.6.4 4.6.2 5 1.2 1.3 2 3 2 5.1 0 7.3-4.5 8.9-8.7 9.4.7.6 1.3 1.7 1.3 3.5v5.2c0 .5.4 1.1 1.3.9 7.5-2.6 13-9.7 13-18.1 0-10.5-8.5-19-19-19z'
                  }
                />
              </svg>
            </a>
          </div>
        )}
      </nav>

      {!file && (
        <div className={'dropzone'} {...getRootProps()}>
          <input {...getInputProps()} />

          {isDragActive
            ? 'Drop a ZIP file here…'
            : 'Click to select a ZIP file'}
        </div>
      )}

      <div className={'main'}>
        <div
          className={classnames({
            flex: true,
            sidebar: true,
          })}
        >
          {files && (
            <Files
              files={files}
              selectedFilename={selectedFilename}
              selectFile={selectFile}
            />
          )}

          {changed && (
            <div className={'download'} onClick={downloadZip}>
              Download updated ZIP file
            </div>
          )}
        </div>

        <div className={'flex editor'}>
          {error && <div className={'error message'}>{error}</div>}

          {selectedFilename && (
            <div className={'filename'}>
              <span onClick={downloadSelectedFile}>{selectedFilename}</span>
            </div>
          )}

          <div className={'monaco'} ref={editorRef} />
        </div>
      </div>
    </nav>
  )
}
