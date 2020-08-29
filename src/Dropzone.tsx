import React from 'react'
import { useDropzone } from 'react-dropzone'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'

export const Dropzone: React.FC<{
  editor?: monaco.editor.IStandaloneCodeEditor
  setError: (error: string) => void
  setFile: (file: File) => void
  setFilename: (filename: string) => void
}> = React.memo(({ editor, setError, setFile, setFilename }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    onDrop: (acceptedFiles) => {
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

  return (
    <div className={'dropzone'} {...getRootProps()}>
      <input {...getInputProps()} />

      {isDragActive ? (
        'Drop a ZIP file here…'
      ) : (
        <div className={'intro'}>
          <div>Edit the contents of a ZIP file</div>
          <div className={'extensions'}>
            (including EPUB, DOCX, XLSX, PPTX, ODT)
          </div>
          <div className={'choose'}>
            Drag a ZIP
            <br />
            or click to select a file
          </div>
        </div>
      )}
    </div>
  )
})
