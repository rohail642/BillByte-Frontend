import { useQuery } from '@tanstack/react-query'
import { getDashboardSummary } from '../../api/orders'
import { getQrRequests } from '../../api/tableOrdering'

export function qrBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator(); const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination); o.type = 'sine'
    o.frequency.setValueAtTime(988, ctx.currentTime); o.frequency.setValueAtTime(1319, ctx.currentTime + 0.12)
    g.gain.setValueAtTime(0.35, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    o.start(); o.stop(ctx.currentTime + 0.4)
  } catch { /* no audio */ }
}

// The waiting count rides on /orders/summary, which the Topbar already polls.
// The request list is only fetched while that count is above zero, so a quiet
// restaurant makes no extra calls.
export function usePendingQr() {
  const { data: summary } = useQuery({ queryKey: ['summary'], queryFn: getDashboardSummary })
  const count = summary?.qr_pending || 0
  const q = useQuery({
    queryKey: ['qrRequests', 'pending'],
    queryFn: () => getQrRequests('pending'),
    enabled: count > 0,
    refetchInterval: count > 0 ? 10000 : false,
  })
  return { count, requests: count > 0 ? (q.data || []) : [], isLoading: count > 0 && q.isLoading }
}
