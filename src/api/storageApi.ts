import http from './index'
import axios from 'axios'

export interface PresignedUploadResponse {
  uploadUrl: string
  objectKey: string
  publicUrl: string
}

export interface PresignedDownloadResponse {
  downloadUrl: string
}

export function getPresignedUpload(fileName: string, contentType: string) {
  return http.post<PresignedUploadResponse>('/storage/presigned-upload', { fileName, contentType })
}

export function getPresignedDownload(objectKey: string) {
  return http.get<PresignedDownloadResponse>('/storage/presigned-download', { params: { objectKey } })
}

// presigned URL로 파일을 직접 PUT 업로드한다.
// http 인스턴스를 쓰면 Authorization 헤더가 붙어 R2/S3가 거부하므로 bare axios를 사용한다.
export async function uploadFileToStorage(uploadUrl: string, file: File): Promise<void> {
  await axios.put(uploadUrl, file, { headers: { 'Content-Type': file.type || 'application/octet-stream' } })
}

// 단일 파일을 presigned URL로 업로드하고 objectKey를 반환한다.
// BE가 objectKey로 publicUrl을 결정론적으로 생성하므로 FE는 objectKey만 전달하면 된다.
export async function uploadFileAndGetKey(file: File): Promise<string> {
  const res = await getPresignedUpload(file.name, file.type || 'application/octet-stream')
  await uploadFileToStorage(res.data.uploadUrl, file)
  return res.data.objectKey
}
