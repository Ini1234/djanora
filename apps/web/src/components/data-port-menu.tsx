'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { getErrorMessage } from '@/lib/errors'
import { downloadCsv, downloadXlsx, parseGridFile, type SheetCell } from '@/lib/sheet-io'

type Format = 'csv' | 'xlsx' | 'notion'

export function DataPortMenu({
  fileBase,
  sheetName,
  headers,
  rows,
  canImport,
  triggerClassName,
  onAskDjan,
}: {
  fileBase: string
  sheetName: string
  headers: readonly string[]
  rows: SheetCell[][]
  canImport: boolean
  triggerClassName?: string
  onAskDjan?: (input: { filename: string; grid: string[][]; truncated: boolean }) => void
}) {
  const t = useTranslations('dataPort')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  async function exportAs(format: Format) {
    const cols = [...headers]
    try {
      if (format === 'xlsx') {
        await downloadXlsx(`${fileBase}.xlsx`, sheetName, cols, rows)
      } else {
        downloadCsv(format === 'notion' ? `${fileBase}-notion.csv` : `${fileBase}.csv`, cols, rows)
      }
    } finally {
      setOpen(false)
    }
  }

  async function pickFile(file: File | undefined) {
    if (!file || !onAskDjan) return
    setError('')
    setBusy(true)
    try {
      const parsed = await parseGridFile(file)
      if (parsed.grid.length === 0) {
        setError(t('emptyFile'))
        return
      }
      onAskDjan({ filename: file.name, grid: parsed.grid, truncated: parsed.truncated })
      setOpen(false)
    } catch (err) {
      setError(getErrorMessage(err, t('parseFailed')))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={triggerClassName ?? 'btn btn-secondary btn-sm'}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} {t('menu')}
      </button>
      {open && (
        <div
          role="menu"
          className="border-border bg-card absolute right-0 z-20 mt-1 min-w-[13rem] overflow-hidden rounded-xl border py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => void exportAs('csv')}
          >
            {t('exportCsv')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => void exportAs('xlsx')}
          >
            {t('exportExcel')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={() => void exportAs('notion')}
          >
            {t('exportNotion')}
          </button>
          {canImport && onAskDjan && (
            <>
              <div className="border-border my-1 border-t" />
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={12} className="mr-1.5" /> {t('import')}
              </button>
            </>
          )}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => void pickFile(e.target.files?.[0])}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
