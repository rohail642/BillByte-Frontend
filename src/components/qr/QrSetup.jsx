// Table QR ordering setup — shown as the "Table QR" tab in Settings.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import { Printer, RefreshCw, Copy, ExternalLink } from 'lucide-react'
import { clsx } from 'clsx'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import Spinner from '../ui/Spinner'
import { getQrSettings, saveQrSettings, getQrTables, regenerateQrCodes, guestOrderUrl } from '../../api/tableOrdering'

const PRINT_CSS = `
#qr-print { display: none; }
@media print {
  body * { visibility: hidden !important; }
  #qr-print, #qr-print * { visibility: visible !important; }
  #qr-print { display: grid !important; position: absolute; left: 0; top: 0; width: 100%;
    grid-template-columns: repeat(3, 1fr); gap: 8mm; }
  #qr-print .qr-card { break-inside: avoid; border: 1px dashed #999; border-radius: 12px; padding: 6mm;
    display: flex; flex-direction: column; align-items: center; text-align: center; color: #000; background: #fff; }
}`

// One full-size table poster — used for printing and the preview modal.
function QrPoster({ restaurantName, table, img, className }) {
  return (
    <div className={clsx('qr-card bg-white text-black rounded-xl border border-border p-4 flex flex-col items-center text-center', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 truncate max-w-full">{restaurantName}</p>
      <p className="font-display font-black text-3xl leading-tight">Table {table.table_number}</p>
      {img
        ? <img src={img} alt={`QR code for table ${table.table_number}`} className="w-full max-w-[220px] aspect-square my-2" />
        : <div className="w-full max-w-[220px] aspect-square my-2 bg-neutral-100 rounded" />}
      <p className="text-sm font-semibold">Scan to see the menu & order</p>
    </div>
  )
}

function Switch({ checked, onChange, label }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={clsx('relative w-9 h-5 rounded-full transition-colors duration-200', checked ? 'bg-green' : 'bg-border2')}>
      <span className={clsx('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200', checked ? 'left-4' : 'left-0.5')} />
    </button>
  )
}

function SettingRow({ title, description, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text">{title}</p>
        {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export default function QrSetup({ onEditTables }) {
  const qc = useQueryClient()
  const { data: settings, isLoading } = useQuery({ queryKey: ['qrSettings'], queryFn: getQrSettings })
  const { data: tableData } = useQuery({ queryKey: ['qrTables'], queryFn: getQrTables, refetchOnMount: 'always' })
  const [upi, setUpi] = useState(null)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [preview, setPreview] = useState(null)   // table shown in the preview modal
  const [printOnly, setPrintOnly] = useState(null) // null = print all tables
  const [imgs, setImgs] = useState({})

  const tables = tableData?.tables
  useEffect(() => {
    if (!tables) return
    let alive = true
    Promise.all(tables.map(t =>
      QRCode.toDataURL(guestOrderUrl(t.token), { margin: 1, width: 360, errorCorrectionLevel: 'M' }).then(u => [t.table_number, u])
    )).then(pairs => alive && setImgs(Object.fromEntries(pairs)))
    return () => { alive = false }
  }, [tables])

  // Print after React has rendered the print sheet for the chosen table(s).
  const [printNonce, setPrintNonce] = useState(0)
  useEffect(() => {
    if (!printNonce) return
    const done = () => setPrintOnly(null)
    window.addEventListener('afterprint', done, { once: true })
    window.print()
  }, [printNonce])
  const printTables = t => { setPrintOnly(t || null); setPrintNonce(n => n + 1) }

  const save = useMutation({
    mutationFn: saveQrSettings,
    onSuccess: d => { qc.setQueryData(['qrSettings'], d); toast.success('Saved'); setUpi(null) },
    onError: e => toast.error(e || 'Could not save'),
  })
  const regen = useMutation({
    mutationFn: regenerateQrCodes,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['qrTables'] }); setConfirmRegen(false); toast.success('New QR codes created — print and replace the old ones') },
  })

  if (isLoading || !settings) return <div className="py-16 flex justify-center"><Spinner /></div>
  const upiVal = upi ?? settings.upi_vpa ?? ''
  const restaurantName = tableData?.restaurant_name || ''

  // Group tables by section (if the restaurant uses sections), preserving order.
  const groups = []
  for (const t of tables || []) {
    const name = t.section || ''
    let g = groups.find(x => x.name === name)
    if (!g) groups.push(g = { name, tables: [] })
    g.tables.push(t)
  }

  const copyLink = t => {
    navigator.clipboard?.writeText(guestOrderUrl(t.token)).then(() => toast.success('Link copied'), () => toast.error('Could not copy'))
  }

  return (
    <div className="space-y-4">
      <style>{PRINT_CSS}</style>
      <div>
        <h3 className="font-display font-bold text-sm text-text">Table QR Ordering</h3>
        <p className="text-xs text-muted mt-0.5">Guests scan a code on their table, see the menu and order from their phone. New orders appear under the bell and at the top of Orders for staff to accept.</p>
      </div>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)] items-start">

      {/* ── Left: settings ── */}
      <div className="space-y-4">
        <Card className="py-2">
          <div className="flex items-center justify-between pt-2 pb-1">
            <h3 className="font-display font-bold">Settings</h3>
            <span className={clsx('text-[11px] font-bold px-2 py-0.5 rounded-full',
              settings.qr_ordering_enabled ? 'bg-green-dim text-green' : 'bg-surface2 text-text3')}>
              {settings.qr_ordering_enabled ? 'Live' : 'Off'}
            </span>
          </div>
          <div className="divide-y divide-border">
            <SettingRow title="Table ordering" description="Guests scan the QR on their table to order.">
              <Switch label="Table ordering" checked={settings.qr_ordering_enabled} onChange={v => save.mutate({ qr_ordering_enabled: v })} />
            </SettingRow>
            <SettingRow title="Skip staff confirmation" description="Keep off so staff approve each order first.">
              <Switch label="Skip staff confirmation" checked={settings.qr_auto_accept} onChange={v => save.mutate({ qr_auto_accept: v })} />
            </SettingRow>
          </div>
        </Card>

        <Card className="space-y-2">
          <h3 className="font-display font-bold">UPI payments <span className="text-xs font-normal text-muted">(optional)</span></h3>
          <p className="text-xs text-muted">Guests get GPay / PhonePe / Paytm buttons with the bill amount filled in, plus your UPI ID to copy. Use a <b>business</b> UPI ID (GPay for Business, PhonePe Business, Paytm for Business): UPI apps often block link payments to personal UPI IDs. Staff still confirm the payment and mark the bill paid.</p>
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <Input placeholder="yourcafe@okhdfcbank" value={upiVal} onChange={e => setUpi(e.target.value)} />
            </div>
            <Button variant="primary" disabled={upi === null || upi === settings.upi_vpa} loading={save.isPending}
              onClick={() => save.mutate({ upi_vpa: upiVal })}>Save</Button>
          </div>
          <p className="text-[11px] text-text3">Money goes straight to your account — still mark the bill paid on the POS.</p>
        </Card>
      </div>

      {/* ── Right: QR codes ── */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <h3 className="font-display font-bold">Table QR codes</h3>
            <p className="text-xs text-muted">{tables ? `${tables.length} table${tables.length === 1 ? '' : 's'}` : 'Loading…'} · click a table to preview or print it alone{onEditTables && <> · <button className="text-green2 font-semibold hover:underline" onClick={onEditTables}>Edit tables</button></>}</p>
          </div>
          <Button variant="primary" size="sm" icon={<Printer size={14} />} disabled={!tables?.length} onClick={() => printTables(null)}>Print all</Button>
        </div>

        {!settings.qr_ordering_enabled && (
          <p className="text-xs bg-amber-dim text-amber rounded-lg px-3 py-2">Table ordering is off — scanning a code shows guests “not available” until you turn it on.</p>
        )}

        {!tables ? <div className="py-10 flex justify-center"><Spinner /></div>
          : tables.length === 0 ? <p className="text-sm text-muted py-6 text-center">No tables set up yet — add them in the Tables tab.</p>
          : groups.map(g => (
            <div key={g.name || '_'}>
              {g.name && <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">{g.name}</p>}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2">
                {g.tables.map(t => (
                  <button key={t.table_number} onClick={() => setPreview(t)}
                    className="group flex flex-col items-center gap-1 rounded-lg border border-border bg-surface2 p-2 hover:border-green hover:bg-green-dim transition-colors">
                    {imgs[t.table_number]
                      ? <img src={imgs[t.table_number]} alt="" className="w-14 h-14 rounded bg-white p-0.5" />
                      : <div className="w-14 h-14 rounded bg-surface" />}
                    <span className="text-xs font-semibold text-text truncate max-w-full">{t.table_number}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

        <div className="border-t border-border pt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="mr-auto">Photo of a code being misused?</span>
          <button className="text-red font-semibold hover:underline flex items-center gap-1" onClick={() => setConfirmRegen(true)}>
            <RefreshCw size={12} /> Replace all codes
          </button>
        </div>
      </Card>

      {/* Print-only sheet: every table, or just the one chosen */}
      {createPortal(
        <div id="qr-print">
          {(tables || []).filter(t => !printOnly || t.table_number === printOnly.table_number).map(t => (
            <QrPoster key={t.table_number} restaurantName={restaurantName} table={t} img={imgs[t.table_number]} />
          ))}
        </div>, document.body)}

      <Modal open={!!preview} onClose={() => setPreview(null)} title={`Table ${preview?.table_number}`} size="sm"
        footer={<>
          <Button variant="ghost" icon={<Copy size={14} />} onClick={() => copyLink(preview)}>Copy link</Button>
          <Button variant="primary" icon={<Printer size={14} />} onClick={() => { const t = preview; setPreview(null); printTables(t) }}>Print</Button>
        </>}>
        {preview && (
          <div className="space-y-2">
            <QrPoster restaurantName={restaurantName} table={preview} img={imgs[preview.table_number]} />
            <a href={guestOrderUrl(preview.token)} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-1 text-xs text-blue hover:underline"><ExternalLink size={12} /> Open guest page</a>
          </div>
        )}
      </Modal>

      <Modal open={confirmRegen} onClose={() => setConfirmRegen(false)} title="Replace all QR codes?" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setConfirmRegen(false)}>Cancel</Button>
          <Button variant="danger" loading={regen.isPending} onClick={() => regen.mutate()}>Replace codes</Button>
        </>}>
        <p className="text-sm text-text2">Every QR code you've printed will stop working immediately. You'll need to print and stick the new codes on every table.</p>
      </Modal>
    </div>
    </div>
  )
}
