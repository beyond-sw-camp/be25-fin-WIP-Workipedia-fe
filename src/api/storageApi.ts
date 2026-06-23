import axios from 'axios'
import http from './index'

interface PresignedUploadResponse {
  uploadUrl: string
  objectKey: string
  publicUrl: string
}

export async function uploadTicketReply(file: File): Promise<string> {
  const contentType = file.type || 'application/octet-stream'
  const { data } = await http.post<PresignedUploadResponse>('/storage/presigned-upload', {
    fileName: file.name,
    contentType,
  })

  await axios.put(data.uploadUrl, file, {
    headers: { 'Content-Type': contentType },
    timeout: 60000,
  })

  return data.objectKey
}
