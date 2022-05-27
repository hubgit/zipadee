import { memo, useEffect } from 'react'

export const LaunchQueue = memo<{
  setFile: (file: File) => void
  setFilename: (filename: string) => void
}>(({ setFile, setFilename }) => {
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if ('launchQueue' in window && 'files' in LaunchParams.prototype) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      window.launchQueue.setConsumer(
        async (launchParams: { files: FileSystemFileHandle[] }) => {
          if (!launchParams.files.length) {
            return
          }
          const [fileHandle] = launchParams.files
          const file = await fileHandle.getFile()
          setFile(file)
          setFilename(file.name)
        }
      )
    }
  }, [setFile, setFilename])

  return null
})
