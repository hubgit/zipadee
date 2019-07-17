import classnames from 'classnames'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import './App.css'

export const App: React.FC = () => {
  const [error, setError] = useState<string>()
  const [file, setFile] = useState<File>()
  const [zip, setZip] = useState<JSZip>()
  const [files, setFiles] = useState<string[]>()
  const [selectedFilename, setSelectedFilename] = useState<string>()
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor>()

  // reset
  const handleReset = useCallback(() => {
    setError(undefined)
    setFile(undefined)
    setZip(undefined)
    setFiles(undefined)
    setSelectedFilename(undefined)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    onDrop: acceptedFiles => {
      handleReset()

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
            setError(`This is not a ZIP file?`)
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
            const monacoEditor = await import(
              // eslint-disable-next-line import/no-unresolved
              /* webpackPrefetch: true */ 'monaco-editor'
            )
            let existingEditor = editor

            if (!existingEditor) {
              if (!editorRef.current) {
                throw new Error('Editor node not mounted')
              }

              const editor = monaco.editor.create(editorRef.current, {
                wordWrap: 'on',
              })

              setEditor(editor)

              existingEditor = editor
            }

            const prevModel = existingEditor.getModel()

            if (prevModel) {
              prevModel.dispose()
            }

            const model = monacoEditor.editor.createModel(
              code,
              undefined,
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
      })
    }

    return () => {
      if (disposable) {
        disposable.dispose()
      }
    }
  }, [editor, zip, selectedFilename])

  return (
    <div className={'container'}>
      <div className={'flex sidebar'}>
        <div className={'dropzone'} {...getRootProps()}>
          <input {...getInputProps()} />

          {isDragActive
            ? 'Drop a file here…'
            : 'Click to select a ZIP file for editing'}
        </div>

        <div className={'files'}>
          {files &&
            files.map(file => (
              <div
                className={classnames({
                  file: true,
                  selected: selectedFilename === file,
                })}
                key={file}
                onClick={() => selectFile(file)}
                title={file}
              >
                {file}
              </div>
            ))}
        </div>

        {zip && file && (
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
  )
}
