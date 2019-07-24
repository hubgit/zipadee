import classnames from 'classnames'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import 'balloon-css'
import './App.css'
import { Files } from './Files'
import { GitHubLink } from './GitHubLink'
import fileType from 'file-type'

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

const decoder = new TextDecoder('utf-8')

export const App: React.FC = () => {
  const [error, setError] = useState<string>()
  const [file, setFile] = useState<File>()
  const [filename, setFilename] = useState<string>()
  const [zip, setZip] = useState<JSZip>()
  const [files, setFiles] = useState<string[]>()
  const [selectedFilename, setSelectedFilename] = useState<string>()
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor>()
  const [changed, setChanged] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent>()
  const [previewURL, setPreviewURL] = useState<string>()
  const [observer, setObserver] = useState<ResizeObserver>()

  // reset
  const handleReset = useCallback(() => {
    setError(undefined)
    setFile(undefined)
    setFilename(undefined)
    setZip(undefined)
    setFiles(undefined)
    setSelectedFilename(undefined)
    setChanged(false)
    setPreviewURL(undefined)
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
        const file = acceptedFiles[0]
        setFile(file)
        setFilename(file.name)
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
  }, [zip, filename])

  const editorRef = useRef<HTMLDivElement>(null)

  // open the selected file in the editor
  const selectFile = useCallback(
    (selectedFilename: string) => {
      if (zip) {
        setSelectedFilename(selectedFilename)

        zip
          .file(selectedFilename)
          .async('arraybuffer')
          .then(async code => {
            let existingEditor = editor

            if (!existingEditor) {
              if (!editorRef.current) {
                throw new Error('Editor node not mounted')
              }

              const theme = await import(
                /* webpackPrefetch: true */ 'monaco-themes/themes/GitHub.json'
              )

              monaco.editor.defineTheme(
                'github',
                theme as monaco.editor.IStandaloneThemeData
              )

              const editor = monaco.editor.create(editorRef.current, {
                wordWrap: 'on',
                theme: 'github',
                // automaticLayout: true,
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
              decoder.decode(code),
              chooseLanguage(selectedFilename),
              monacoEditor.Uri.file(selectedFilename)
            )

            existingEditor.setModel(model)

            existingEditor.focus()

            const result = fileType(code)

            console.log(result)

            const previewURL =
              result && result.mime.startsWith('image/')
                ? URL.createObjectURL(new Blob([code], { type: result.mime }))
                : undefined

            setPreviewURL(previewURL)
          })
          .catch(error => {
            setError(error.message)
          })
      }
    },
    [zip, editor]
  )

  // redo the editor layout when the container size changes
  const editorContainerMounted = useCallback(
    node => {
      if (node && editor && !observer) {
        const observer = new window.ResizeObserver(entries => {
          for (const entry of entries) {
            if (node.isSameNode(entry.target)) {
              const {
                contentRect: { width, height },
              } = entry

              editor.layout({ width, height })
            }
          }
        })

        observer.observe(node)

        setObserver(observer)
      }
    },
    [editor, observer]
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
  }, [installPrompt])

  const filenameRef = useRef<HTMLInputElement>(null)

  // handle edits to the file name
  const handleFilenameChange = useCallback(event => {
    setFilename(event.target.value)
    setChanged(true)
  }, [])

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
    <nav
      className={classnames({
        container: true,
        fullscreen: !file,
      })}
    >
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
            <form className={'filename-form'} onSubmit={handleFilenameSubmit}>
              <input
                ref={filenameRef}
                onChange={handleFilenameChange}
                className={'filename-input'}
                value={filename}
                size={filename.length}
                aria-label={'Edit the ZIP file name'}
                data-balloon-pos={'right'}
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
                Save updated ZIP
              </div>
            )}

            {installPrompt && (
              <button
                className={'button install'}
                onClick={showInstallPrompt}
                aria-label={'Install Zipadee for use offline'}
                data-balloon-pos={'left'}
              >
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
        <div className={'sidebar'}>
          {files && (
            <Files
              files={files}
              selectedFilename={selectedFilename}
              selectFile={selectFile}
            />
          )}
        </div>

        <div className={'editor'} ref={editorContainerMounted}>
          {error && <div className={'error message'}>{error}</div>}

          {selectedFilename && (
            <div className={'filename'}>
              <span
                onClick={downloadSelectedFile}
                aria-label={'Download this file'}
                data-balloon-pos={'right'}
              >
                {selectedFilename}
              </span>
            </div>
          )}

          {previewURL && (
            <div className={'preview'}>
              <img
                src={previewURL}
                className={'preview-image'}
                alt={'image preview'}
              />
            </div>
          )}

          <div
            className={classnames({ monaco: true, hidden: previewURL })}
            ref={editorRef}
          />
        </div>
      </div>
    </nav>
  )
}
