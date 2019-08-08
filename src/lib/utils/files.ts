import axios from 'axios'

export function getPresignedURLs(files: any[], requestPresignedURL: any): Promise<any> {
  return Promise.all(
    files.map(async file => {
      const result = await requestPresignedURL({
        variables: {
          fileType: file.type,
        },
      })
      const { fileName, signedUrl } = result.data.requestPresignedURL
      return { file, fileName, signedUrl }
    })
  )
}

export function uploadFilesToPresignedURLs(files: any[]): Promise<any> {
  return Promise.all(files.map(({ file, signedUrl }) => axios.put(signedUrl, file)))
}
