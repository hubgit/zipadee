import 'balloon-css'
import classnames from 'classnames'
import { saveAs } from 'file-saver'
import fileType from 'file-type'
import JSZip from 'jszip'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import ResizeObserver from 'resize-observer-polyfill'
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

const decoder = new TextDecoder('utf-8')

export const App: React.FC = () => {
  const [code, setCode] = useState<ArrayBuffer>()
  const [changed, setChanged] = useState(false)
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor>()
  const [error, setError] = useState<string>()
  const [file, setFile] = useState<File>()
  const [filename, setFilename] = useState<string>()
  const [files, setFiles] = useState<string[]>()
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent>()
  const [observer, setObserver] = useState<ResizeObserver>()
  const [previewURL, setPreviewURL] = useState<string>()
  const [selectedFilename, setSelectedFilename] = useState<string>()
  const [zip, setZip] = useState<JSZip>()

  // reset
  const handleReset = useCallback(() => {
    setChanged(false)
    setCode(undefined)
    setError(undefined)
    setFile(undefined)
    setFilename(undefined)
    setFiles(undefined)
    setPreviewURL(undefined)
    setSelectedFilename(undefined)
    setZip(undefined)
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

  // create the editor when the container node is mounted
  const editorRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      import(/* webpackPrefetch: true */ 'monaco-themes/themes/GitHub.json')
        .then(async theme => {
          const monaco = await import(
            // eslint-disable-next-line import/no-unresolved
            /* webpackPrefetch: true */ 'monaco-editor'
          )

          monaco.editor.defineTheme(
            'github',
            theme as monaco.editor.IStandaloneThemeData
          )

          const editor = monaco.editor.create(node, {
            wordWrap: 'on',
            theme: 'github',
            // automaticLayout: true,
          })

          setEditor(editor)
        })
        .catch(error => {
          setError(error.message)
        })
    }
  }, [])

  // select a file
  const selectFile = useCallback((selectedFilename: string) => {
    setSelectedFilename(selectedFilename)
  }, [])

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

          if (files.length) {
            selectFile(files[0])
          }
        })
        .catch(error => {
          if (file.name.endsWith('.zip')) {
            setError(error.message)
          } else {
            setError(`This is not a ZIP file 😖`)
          }
        })
  }, [file, selectFile])

  // open the selected file in the editor
  useEffect(() => {
    if (zip && editor && selectedFilename) {
      zip
        .file(selectedFilename)
        .async('arraybuffer')
        .then(async code => {
          const prevModel = editor.getModel()

          if (prevModel) {
            prevModel.dispose()
          }

          const monaco = await import(
            // eslint-disable-next-line import/no-unresolved
            /* webpackPrefetch: true */ 'monaco-editor'
          )

          if (selectedFilename) {
            const model = monaco.editor.createModel(
              decoder.decode(code),
              chooseLanguage(selectedFilename),
              monaco.Uri.file(selectedFilename)
            )

            editor.setModel(model)
          }

          editor.focus()

          setCode(code)
        })
        .catch(error => {
          setError(error.message)
        })
    }
  }, [zip, editor, selectedFilename])

  // generate a preview URL for images
  useEffect(() => {
    if (code) {
      const result = fileType(code)

      const previewURL =
        result && result.mime.startsWith('image/')
          ? URL.createObjectURL(new Blob([code], { type: result.mime }))
          : undefined

      setPreviewURL(previewURL)
    }
  }, [code])

  // redo the editor layout when the container size changes
  const editorContainerMounted = useCallback(
    node => {
      if (node && editor && !observer) {
        const observer = new ResizeObserver(entries => {
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
            <form
              className={'filename-form'}
              onSubmit={handleFilenameSubmit}
              aria-label={'Edit the ZIP file name'}
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
