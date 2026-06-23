// 파일 업로드 흐름 (presigned URL):
//   1. POST /storage/presigned-upload → BE가 R2/S3 서명 URL(uploadUrl)과 objectKey 반환
//   2. PUT {uploadUrl} — bare axios로 파일 직접 업로드 (BE를 경유하지 않아 서버 부하 없음)
//   3. objectKey를 POST /tickets/{id}/answers 의 fileKey로 전달
//      → BE가 objectKey로 publicUrl을 결정론적으로 생성해 DB에 저장
//
// NOTE: http 인스턴스에는 Authorization 헤더가 붙는다. R2/S3 presigned URL에
//       Authorization을 같이 보내면 서명 불일치로 403이 발생하므로 bare axios를 사용한다.
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

export async function uploadFileToStorage(uploadUrl: string, file: File): Promise<void> {
  await axios.put(uploadUrl, file, { headers: { 'Content-Type': file.type || 'application/octet-stream' } })
}

// 단일 파일을 presigned URL로 업로드하고 objectKey를 반환하는 편의 함수.
// 호출 측은 반환된 objectKey를 answerTicket(fileKey)에 그대로 넘기면 된다.
export async function uploadFileAndGetKey(file: File): Promise<string> {
  const res = await getPresignedUpload(file.name, file.type || 'application/octet-stream')
  await uploadFileToStorage(res.data.uploadUrl, file)
  return res.data.objectKey
}
