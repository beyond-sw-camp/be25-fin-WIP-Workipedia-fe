import http from './index'

export interface Department {
  departmentId: number
  departmentName: string
}

export function getDepartments() {
  return http.get<Department[]>('/departments')
}
