import { fileOpen } from 'browser-nativefs'
import React, { useCallback } from 'react'

export const Info: React.FC<{
  setFile: (file: File) => void
  setFilename: (filename: string) => void
}> = ({ setFile, setFilename }) => {
  // open a file picker
  const handleOpen = useCallback(() => {
    fileOpen()
      .then(async (file) => {
        if (!file) {
          return
        }

        setFile(file)
        setFilename(file.name)
      })
      .catch((error) => {
        console.error(error)
        // setError(error)
      })
  }, [setFile, setFilename])

  // https://wicg.github.io/file-system-access/#draganddrop-example
  const dropzoneRef = useCallback(
    (element) => {
      if (!element) {
        return
      }

      element.addEventListener('dragover', (event: DragEvent) => {
        // Prevent navigation.
        event.preventDefault()
      })

      element.addEventListener('drop', async (event: DragEvent) => {
        // Prevent navigation.
        event.preventDefault()

        if (event.dataTransfer) {
          const [item] = event.dataTransfer.items

          // kind will be 'file' for file/directory entries.
          if (item && item.kind === 'file') {
            const handle = await item.getAsFileSystemHandle()

            if (handle.kind === 'file') {
              const file = await handle.getFile()
              if (file) {
                file.handle = handle
                setFile(file)
                setFilename(file.name)
              }
            }
          }
        }
      })
    },
    [setFile, setFilename]
  )

  return (
    <div className={'infobox'} onClick={handleOpen} ref={dropzoneRef}>
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
    </div>
  )
}
