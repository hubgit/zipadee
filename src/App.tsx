import classnames from 'classnames'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import './App.css'
import { Files } from './Files'
import { GitHubLink } from './GitHubLink'

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
            {changed && (
              <div className={'button download'} onClick={downloadZip}>
                Save updated ZIP
              </div>
            )}

            {installPrompt && (
              <button className={'button install'} onClick={showInstallPrompt}>
                Install
              </button>
            )}

            <GitHubLink repo={'hubgit/zipadee'} />
          </div>
        )}
      </nav>

      {!file && (
        <div className={'dropzone'} {...getRootProps()}>
          <input {...getInputProps()} />

          {isDragActive ? (
            'Drop a ZIP file here…'
          ) : (
            <div className={'intro'}>
              <div>View or edit the contents of a ZIP file</div>
              <div className={'extensions'}>
                (including EPUB, DOCX, XLSX, PPTX, ODT)
              </div>
              <button className={'button choose'}>Choose a file</button>
            </div>
          )}
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
