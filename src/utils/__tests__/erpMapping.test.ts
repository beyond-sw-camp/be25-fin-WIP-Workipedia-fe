import { describe, it, expect } from 'vitest'
import { suggestMapping, toCanonical, isMappingComplete } from '@/utils/erpMapping'

describe('suggestMapping', () => {
  it('ERP식 컬럼명을 자동 매칭한다', () => {
    const m = suggestMapping(['deptCd', 'deptNm', 'dutyDesc', 'useYn'])
    expect(m.externalId).toBe('deptCd')
    expect(m.departmentName).toBe('deptNm')
    expect(m.dutyDesc).toBe('dutyDesc')
    expect(m.useYn).toBe('useYn')
  })
  it('한글 컬럼명도 매칭한다', () => {
    const m = suggestMapping(['부서코드', '조직명', '주요업무', '사용여부'])
    expect(m.externalId).toBe('부서코드')
    expect(m.departmentName).toBe('조직명')
  })
})

describe('toCanonical / isMappingComplete', () => {
  it('매핑으로 캐노니컬을 만든다', () => {
    const rows = [{ deptCd: 'D-1', deptNm: '인사팀', dutyDesc: '채용', useYn: 'Y' }]
    const m = { externalId: 'deptCd', departmentName: 'deptNm', dutyDesc: 'dutyDesc', useYn: 'useYn' }
    const out = toCanonical(rows, m)
    expect(out[0]).toEqual({ externalId: 'D-1', departmentName: '인사팀', dutyDesc: '채용', useYn: 'Y' })
  })
  it('필수 미매핑이면 false', () => {
    expect(isMappingComplete({ externalId: null, departmentName: 'x', dutyDesc: null, useYn: null })).toBe(false)
    expect(isMappingComplete({ externalId: 'a', departmentName: 'b', dutyDesc: null, useYn: null })).toBe(true)
  })
})
