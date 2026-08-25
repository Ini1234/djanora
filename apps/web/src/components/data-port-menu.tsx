'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, Upload } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { getErrorMessage } from '@/lib/errors'
import {
  downloadCsv,
  downloadXlsx,
  parseTableFile,
  type SheetCell,
  type SheetTable,
} from '@/lib/sheet-io'

type Format = 'csv' | 'xlsx' | 'notion'

export function DataPortMenu({
  fileBase,
  sheetName,
  headers,
  rows,
  canImport,
  triggerClassName,
  onImport,
}: {
  fileBase: string
  sheetName: string
  headers: readonly string[]
  rows: SheetCell[][]
  canImport: boolean
  triggerClassName?: string
  onImport: (table: SheetTable) => Promise<{ created: number; skipped: number; issues: string[] }>
}) {
  const t = useTranslations('dataPort')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{
    table: SheetTable
    result?: { created: number; skipped: number; issues: string[] }
  } | null>(null)
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
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const table = await parseTableFile(file)
      if (table.headers.length === 0) {
        setError(t('emptyFile'))
        return
      }
      setPreview({ table })
      setOpen(false)
    } catch (err) {
      setError(getErrorMessage(err, t('parseFailed')))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function commitImport() {
    if (!preview) return
    setBusy(true)
    setError('')
    try {
      const result = await onImport(preview.table)
      setPreview({ ...preview, result })
    } catch (err) {
      setError(getErrorMessage(err, t('importFailed')))
    } finally {
      setBusy(false)
    }
  }

  const previewRows = preview?.table.rows ?? []

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={triggerClassName ?? 'btn btn-secondary btn-sm'}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Download size={13} /> {t('menu')}
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
          {canImport && (
            <>
              <div className="border-border my-1 border-t" />
              <button
                type="button"
                role="menuitem"
                className="menu-item"
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

      {preview && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="border-border bg-card max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-5 shadow-xl">
            <h3 className="text-foreground text-sm font-semibold">
              {preview.result ? t('importDone') : t('importPreview')}
            </h3>
            {preview.result ? (
              <p className="text-muted mt-2 text-xs">
                {t('importSummary', {
                  created: preview.result.created,
                  skipped: preview.result.skipped,
                })}
              </p>
            ) : (
              <p className="text-muted mt-2 text-xs">
                {t('previewCount', { count: previewRows.length })}
              </p>
            )}
            <div className="border-border mt-3 overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-border bg-foreground/5 border-b">
                    {preview.table.headers.slice(0, 6).map((header) => (
                      <th key={header} className="text-muted px-2 py-1.5 font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 8).map((row, i) => (
                    <tr key={i} className="border-border border-t">
                      {row.slice(0, 6).map((value, j) => (
                        <td key={j} className="text-foreground max-w-[8rem] truncate px-2 py-1.5">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.result?.issues.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] text-amber-400">
                {preview.result.issues.slice(0, 8).map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setPreview(null)
                  setError('')
                }}
              >
                {t('close')}
              </button>
              {!preview.result && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy || previewRows.length === 0}
                  onClick={() => void commitImport()}
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {t('importConfirm', { count: previewRows.length })}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {error && !preview && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
