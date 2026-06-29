import { describe, it, expect } from 'vitest'
import { parseCsv, parseJson } from '@/utils/erpParser'

describe('parseCsv', () => {
  it('헤더와 행을 분리한다', () => {
    const r = parseCsv('부서코드,조직명\nD-1,인사팀\nD-2,영업팀')
    expect(r.columns).toEqual(['부서코드', '조직명'])
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]).toEqual({ 부서코드: 'D-1', 조직명: '인사팀' })
  })
  it('빈 줄을 무시한다', () => {
    const r = parseCsv('a,b\n1,2\n\n')
    expect(r.rows).toHaveLength(1)
  })
})

describe('parseJson', () => {
  it('data 배열을 컬럼/행으로 변환한다', () => {
    const r = parseJson('{"data":[{"deptCd":"D-1","deptNm":"인사팀","useYn":"Y"}]}')
    expect(r.columns).toContain('deptCd')
    expect(r.rows[0].deptNm).toBe('인사팀')
  })
  it('최상위 배열도 처리한다', () => {
    const r = parseJson('[{"a":1}]')
    expect(r.rows[0].a).toBe('1')
  })
})
