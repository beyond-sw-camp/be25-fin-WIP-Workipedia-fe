export type FieldKey = 'externalId' | 'departmentName' | 'dutyDesc' | 'useYn'
export type Mapping = Record<FieldKey, string | null>

export interface ErpDepartmentItem {
  externalId: string
  departmentName: string
  dutyDesc: string | null
  useYn: string
}

export const TARGET_FIELDS: { key: FieldKey; label: string; required: boolean }[] = [
  { key: 'externalId', label: 'externalId (ERP 부서코드)', required: true },
  { key: 'departmentName', label: 'departmentName (부서명)', required: true },
  { key: 'dutyDesc', label: '담당업무 (R&R)', required: false },
  { key: 'useYn', label: '사용여부 (폐지 판단)', required: false },
]

const HINTS: Record<FieldKey, string[]> = {
  externalId: ['deptcd', 'departmentcode', '부서코드', 'code', 'id'],
  departmentName: ['deptnm', 'departmentname', '조직명', '부서명', 'name'],
  dutyDesc: ['dutydesc', 'responsibility', '주요업무', '담당업무', 'desc'],
  useYn: ['useyn', 'active', '사용여부', 'status'],
}

// 소스 컬럼명을 휴리스틱으로 우리 필드에 자동 매칭한다.
export function suggestMapping(columns: string[]): Mapping {
  const result: Mapping = { externalId: null, departmentName: null, dutyDesc: null, useYn: null }
  for (const { key } of TARGET_FIELDS) {
    const norm = (c: string) => c.toLowerCase().replace(/[\s_]/g, '')
    const hit =
      columns.find((c) => HINTS[key].some((h) => norm(c) === h)) ??
      columns.find((c) => HINTS[key].some((h) => norm(c).includes(h)))
    result[key] = hit ?? null
  }
  return result
}

// 매핑 규칙으로 행들을 캐노니컬 부서 아이템으로 변환한다.
export function toCanonical(rows: Record<string, string>[], mapping: Mapping): ErpDepartmentItem[] {
  return rows.map((row) => ({
    externalId: mapping.externalId ? (row[mapping.externalId] ?? '') : '',
    departmentName: mapping.departmentName ? (row[mapping.departmentName] ?? '') : '',
    dutyDesc: mapping.dutyDesc ? (row[mapping.dutyDesc] ?? null) : null,
    useYn: (mapping.useYn ? row[mapping.useYn] : 'Y') || 'Y',
  }))
}

// 필수 필드(externalId, departmentName)가 매핑됐는지 확인한다.
export function isMappingComplete(mapping: Mapping): boolean {
  return !!mapping.externalId && !!mapping.departmentName
}
