import { Banknote, Smartphone, CreditCard, Globe, Printer, Wallet } from 'lucide-react'

// Payment method icon: cash, UPI, card, online, print.
const ICONS = { cash: Banknote, upi: Smartphone, card: CreditCard, online: Globe, print: Printer }

export default function PayIcon({ method, size = 14, className = '' }) {
  const Icon = ICONS[method] || Wallet
  return <Icon size={size} className={`inline-block align-[-2px] ${className}`} aria-hidden="true" />
}
