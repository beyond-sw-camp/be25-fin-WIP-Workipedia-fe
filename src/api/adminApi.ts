import http from './index'

interface ApiResponse<T> {
  code: number
  status: string
  message: string
  data: T
}

export interface Department {
  departmentId: number
  name: string
}

export function getDepartments() {
  return http.get<ApiResponse<Department[]>>('/departments')
}
