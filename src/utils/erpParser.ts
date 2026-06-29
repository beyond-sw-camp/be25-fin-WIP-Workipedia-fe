export type ParsedTable = { columns: string[]; rows: Record<string, string>[] }

// CSV 텍스트를 헤더 + 행 배열로 파싱한다. 값은 trim하고 빈 줄은 무시한다.
export function parseCsv(text: string): ParsedTable {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { columns: [], rows: [] }
  const columns = lines[0]!.split(',').map((c) => c.trim())
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(',')
    const row: Record<string, string> = {}
    columns.forEach((col, i) => {
      row[col] = (cells[i] ?? '').trim()
    })
    return row
  })
  return { columns, rows }
}

// JSON 텍스트(최상위 배열 또는 {data:[...]})를 컬럼/행으로 평탄화한다. 값은 문자열화한다.
export function parseJson(text: string): ParsedTable {
  const parsed = JSON.parse(text)
  const arr: unknown[] = Array.isArray(parsed) ? parsed : (parsed?.data ?? [])
  const columns: string[] = []
  const rows = (arr as Record<string, unknown>[]).map((obj) => {
    const row: Record<string, string> = {}
    Object.keys(obj).forEach((k) => {
      if (!columns.includes(k)) columns.push(k)
      const v = obj[k]
      row[k] = v == null ? '' : String(v)
    })
    return row
  })
  return { columns, rows }
}
