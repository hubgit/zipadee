import 'balloon-css'
import classnames from 'classnames'
import { saveAs } from 'file-saver'
import fileType from 'file-type'
import JSZip from 'jszip'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import React, { useCallback, useEffect, useState } from 'react'
import ResizeObserver from 'resize-observer-polyfill'
import './App.css'
import { Dropzone } from './Dropzone'
import { Files } from './Files'
import Split from 'react-split'
import { GitHubCorner } from './GitHubCorner'
import { Nav } from './Nav'

const chooseLanguage = (filename: string) => {
  if (filename.endsWith('-json')) {
    return 'json'
  }

  return undefined
}

const decoder = new TextDecoder('utf-8')

const narrowQuery = window.matchMedia('screen and (max-width: 600px)')

export const App: React.FC = () => {
  const [changed, setChanged] = useState(false)
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor>()
  const [error, setError] = useState<string>()
  const [file, setFile] = useState<File>()
  const [filename, setFilename] = useState<string>()
  const [files, setFiles] = useState<string[]>()
  const [observer, setObserver] = useState<ResizeObserver>()
  const [previewURL, setPreviewURL] = useState<string>()
  const [selectedFilename, setSelectedFilename] = useState<string>()
  const [showPreview, setShowPreview] = useState(true)
  const [zip, setZip] = useState<JSZip>()
  const [narrow, setNarrow] = useState(narrowQuery.matches)
  const [showFiles, setShowFiles] = useState(false)

  // reset
  const handleReset = useCallback(() => {
    setChanged(false)
    setError(undefined)
    setFile(undefined)
    setFilename(undefined)
    setFiles(undefined)
    setPreviewURL(undefined)
    setSelectedFilename(undefined)
    setZip(undefined)
  }, [])

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
    setShowFiles(false)
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
            setError('This is not a ZIP file')
          }
        })
  }, [file, selectFile])

  // open the selected file in the editor
  useEffect(() => {
    if (zip && editor && selectedFilename) {
      const language = chooseLanguage(selectedFilename)
      const uri = monaco.Uri.file(selectedFilename)

      const prevModel = editor.getModel()

      if (prevModel) {
        prevModel.dispose()
      }

      zip
        .file(selectedFilename)
        .async('arraybuffer')
        .then(async buffer => {
          const result = fileType(buffer)

          const previewURL =
            result && result.mime.startsWith('image/')
              ? URL.createObjectURL(new Blob([buffer], { type: result.mime }))
              : undefined

          const monaco = await import(
            // eslint-disable-next-line import/no-unresolved
            /* webpackPrefetch: true */ 'monaco-editor'
          )
          const code = decoder.decode(buffer)
          const model = monaco.editor.createModel(code, language, uri)

          setPreviewURL(previewURL)
          editor.setModel(model)
          editor.updateOptions({ readOnly: !!previewURL })
          editor.focus()
        })
        .catch(error => {
          setError(error.message)
        })
    }
  }, [zip, editor, selectedFilename])

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

  // toggle the image preview
  const togglePreview = useCallback(() => {
    setShowPreview(value => !value)
  }, [])

  // toggle the files sidebar
  const toggleFiles = useCallback(() => {
    setShowFiles(value => !value)
  }, [])

  // observe narrow window
  // NOTE: Safari doesn't support MediaQueryList.addEventListener yet,
  // so still using deprecated addListener
  useEffect(() => {
    const handleChange = (event: MediaQueryListEvent) => {
      setNarrow(event.matches)
    }

    narrowQuery.addListener(handleChange)

    return () => {
      narrowQuery.removeListener(handleChange)
    }
  }, [])

  return (
    <div
      className={classnames({
        container: true,
        fullscreen: !file,
        narrow: narrow,
      })}
    >
      <Nav
        changed={changed}
        file={file}
        filename={filename}
        handleReset={handleReset}
        setChanged={setChanged}
        setError={setError}
        setFilename={setFilename}
        zip={zip}
      />

      {!file && (
        <Dropzone
          editor={editor}
          setError={setError}
          setFile={setFile}
          setFilename={setFilename}
        />
      )}

      {!file && <GitHubCorner repo={'hubgit/zipadee'} />}

      <Split className={'main'} gutterSize={4}>
        <div
          className={'sidebar'}
          style={{
            width: narrow && showFiles ? '100%' : undefined,
          }}
        >
          {files && (showFiles || !narrow) && (
            <Files
              files={files}
              selectedFilename={selectedFilename}
              selectFile={selectFile}
            />
          )}
        </div>

        <div
          className={classnames({
            editor: true,
            hidden: narrow && showFiles,
          })}
          ref={editorContainerMounted}
        >
          {error && <div className={'error message'}>{error}</div>}

          {selectedFilename && (
            <div className={'filename'}>
              <div className={'filename-section filename-section-filename'}>
                {narrow && (
                  <button
                    className={'button toggle-files'}
                    onClick={toggleFiles}
                  >
                    ☰
                  </button>
                )}

                <span
                  onClick={downloadSelectedFile}
                  aria-label={'Download this file'}
                  data-balloon-pos={'right'}
                  className={'selected-filename'}
                >
                  {selectedFilename}
                </span>
              </div>

              <div className={'filename-section filename-section-actions'}>
                {previewURL && (
                  <button
                    className={'button toggle-preview'}
                    onClick={togglePreview}
                  >
                    {showPreview ? 'Show code' : 'Show preview'}
                  </button>
                )}
              </div>
            </div>
          )}

          {previewURL && showPreview && (
            <div className={'preview'}>
              <img
                src={previewURL}
                className={'preview-image'}
                alt={'image preview'}
              />
            </div>
          )}

          <div
            className={classnames({
              monaco: true,
              hidden: previewURL && showPreview,
            })}
            ref={editorRef}
          />
        </div>
      </Split>
    </div>
  )
}
