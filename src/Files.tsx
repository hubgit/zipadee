import classnames from 'classnames'
import React from 'react'

export const Files: React.FC<{
  files: string[]
  selectedFilename?: string
  selectFile: (file: string) => void
}> = React.memo(({ files, selectedFilename, selectFile }) => {
  return (
    <div className={'files'}>
      {files.map(file => (
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
  )
})
