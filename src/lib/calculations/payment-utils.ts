export interface PaymentSummary {
  totalOwed: number
  totalPaid: number
  remaining: number
  overdueAmount: number
  status: 'paid' | 'partial' | 'pending' | 'overdue'
  statusLabel: string
}

interface PaymentData {
  amount: number
  status: string
  dueDate: Date | string | null
  paidAt: Date | string | null
}

export function calculatePaymentSummary(
  contractTotal: number,
  payments: PaymentData[]
): PaymentSummary {
  const now = new Date()
  let totalPaid = 0
  let overdueAmount = 0

  for (const p of payments) {
    if (p.status === 'completed') {
      totalPaid += p.amount
    } else if (p.dueDate && new Date(p.dueDate) < now && p.status !== 'completed') {
      overdueAmount += p.amount
    }
  }

  const remaining = contractTotal - totalPaid

  let status: PaymentSummary['status']
  let statusLabel: string

  if (remaining <= 0) {
    status = 'paid'
    statusLabel = 'Ödendi'
  } else if (overdueAmount > 0) {
    status = 'overdue'
    statusLabel = 'Gecikmiş Ödeme Var'
  } else if (totalPaid > 0) {
    status = 'partial'
    statusLabel = 'Kısmi Ödeme'
  } else {
    status = 'pending'
    statusLabel = 'Ödeme Bekliyor'
  }

  return { totalOwed: contractTotal, totalPaid, remaining, overdueAmount, status, statusLabel }
}

export const PAYMENT_SUMMARY_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  overdue: 'bg-red-100 text-red-800',
}
