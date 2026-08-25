export type SheetTable = {
  headers: string[]
  rows: string[][]
}

export type SheetCell = string | number

function escapeCsv(value: SheetCell) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCsv(headers: string[], rows: SheetCell[][]) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsv).join(','))
  return `\uFEFF${lines.join('\r\n')}`
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function downloadCsv(filename: string, headers: string[], rows: SheetCell[][]) {
  downloadBlob(filename, new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' }))
}

export async function downloadXlsx(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: SheetCell[][],
) {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31) || 'Sheet1')
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  downloadBlob(
    filename,
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  )
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      continue
    }
    if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }
    if (char === '\r') continue
    field += char
  }
  if (quoted) throw new Error('Unclosed quote in CSV')
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim()))
}

function tableFromAoa(aoa: unknown[][]): SheetTable {
  const grid = aoa.map((row) => (Array.isArray(row) ? row : [row]))
  if (grid.length === 0) return { headers: [], rows: [] }
  const width = Math.max(...grid.map((row) => row.length), 0)
  const padded = grid.map((row) =>
    Array.from({ length: width }, (_, i) => String(row[i] ?? '').trim()),
  )
  const headers = padded[0]
  return { headers, rows: padded.slice(1) }
}

export async function parseTableFile(file: File): Promise<SheetTable> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.ods')) {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!sheet) return { headers: [], rows: [] }
    const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    })
    return tableFromAoa(aoa)
  }
  return tableFromAoa(parseCsv(await file.text()))
}

export function fileBase(title: string, kind: string) {
  const stamp = new Date().toISOString().slice(0, 10)
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${slug || 'event'}-${kind}-${stamp}`
}
