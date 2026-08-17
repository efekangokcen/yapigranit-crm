import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { DeleteCustomerDialog } from "@/components/customers/delete-customer-dialog"
import { CustomerSurecIndicator } from "@/components/customers/customer-surec-indicator"
import { SurecAdvanceButton } from "@/components/customers/surec-advance-button"
import { PaymentList } from "@/components/payments/payment-list"
import type { PaymentWithDetails } from "@/components/payments/payment-detail-dialog"
import { getCustomer } from "../actions"
import { getCustomerStonesSummary } from "@/app/tas-takibi/actions"
import { prisma } from "@/lib/prisma"
import { formatCurrency } from "@/lib/utils"
import {
  STATUS_LABELS, STATUS_COLORS, CUSTOMER_DURUM_LABELS, CUSTOMER_DURUM_COLORS, CUSTOMER_KAYNAK_LABELS,
  CONTRACT_ITEM_STATUS_LABELS, CONTRACT_ITEM_STATUS_COLORS,
  CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS,
  ACTIVITY_ACTION_LABELS, ACTIVITY_ACTION_COLORS, ACTIVITY_ENTITY_LABELS,
} from "@/lib/constants"
import { Plus, Gem, AlertCircle, ClipboardList } from "lucide-react"
import { FormPageHeader } from "@/components/ui/form-page-header"

export const dynamic = 'force-dynamic'

export default async function MusteriDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const customer = await getCustomer(Number(id))
  if (!customer) notFound()

  const stonesSummary = await getCustomerStonesSummary(Number(id))

  // Kalem bazlı akış: bu müşterinin sözleşmelerindeki her iş kalemi (ör. "Mutfak Tezgahı",
  // "Banyo Lavabo") kendi ölçü/kesim/montaj durumunu bağımsız taşır — aynı sözleşmede bir
  // kalem bugün kesime giderken diğeri 3 ay sonra ölçüye gidebilir (bkz. ContractItem).
  const contractItems = await prisma.contractItem.findMany({
    where: { customerId: Number(id) },
    include: { contract: { select: { id: true, contractNumber: true } } },
    orderBy: [{ contractId: 'asc' }, { id: 'asc' }],
  })

  const quotes = customer.costCalculations.flatMap((cc) => cc.quotes)
  // Ödeme özeti — taslak ödemeler özet kartlara dahil edilmez
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payments = customer.payments as any[] as PaymentWithDetails[]
  const aktifPayments = payments.filter(p => p.durum !== 'taslak')
  const totalBekleniyor = aktifPayments
    .filter(p => p.durum === 'bekleniyor')
    .reduce((s, p) => s + Math.max(p.tutar - (p.odenenTutar ?? 0), 0), 0)
  const totalAlindi = aktifPayments.reduce((s, p) => s + (p.odenenTutar ?? (p.durum === 'alindi' ? p.tutar : 0)), 0)
  const totalGecikti = aktifPayments
    .filter(p => p.durum === 'gecikti')
    .reduce((s, p) => s + Math.max(p.tutar - (p.odenenTutar ?? 0), 0), 0)

  // Müşterinin sözleşmeleri — Contract.customerId sayesinde tek sorgu; daha önce
  // Customer → CostCalculation → Quote → Contract zinciri üzerinden geliniyordu.
  const contractRows = await prisma.contract.findMany({
    where: { customerId: Number(id) },
    select: {
      id: true, contractNumber: true, status: true, signatureDate: true, createdAt: true,
      quote: { select: { id: true, quoteNumber: true, yapilacakIs: true, toplam: true } },
      payments: {
        where: { deletedAt: null },
        select: { tutar: true, odenenTutar: true, durum: true },
      },
      _count: { select: { items: true } },
    },
    orderBy: [{ signatureDate: 'desc' }, { createdAt: 'desc' }],
  })

  const contracts = contractRows.map(c => ({
    id: c.id,
    contractNumber: c.contractNumber,
    status: c.status,
    signatureDate: c.signatureDate ?? c.createdAt,
    quoteId: c.quote.id,
    quoteNumber: c.quote.quoteNumber,
    yapilacakIs: c.quote.yapilacakIs,
    totalAmount: c.quote.toplam,
    paidAmount: c.payments
      .reduce((sum, p) => sum + (p.odenenTutar ?? (p.durum === 'alindi' ? p.tutar : 0)), 0),
    pendingAmount: c.payments
      .filter(p => p.durum === 'bekleniyor' || p.durum === 'gecikti')
      .reduce((sum, p) => sum + Math.max(p.tutar - (p.odenenTutar ?? 0), 0), 0),
    itemCount: c._count.items,
  }))

  const contractOptions = contracts.map(c => ({
    id: c.id,
    contractNumber: c.contractNumber,
    yapilacakIs: c.yapilacakIs,
    totalAmount: c.totalAmount,
    paidAmount: c.paidAmount,
    pendingAmount: c.pendingAmount,
  }))

  const acikIsSayisi = contractItems.filter((i) => !['completed', 'cancelled'].includes(i.status)).length

  // "Bu müşteriye ne yapılmış" geçmişi: müşterinin kendi kaydı + ona bağlı maliyet,
  // teklif, sözleşme, iş kalemi ve ödeme kayıtlarındaki tüm işlem logları.
  const activityLogs = await prisma.activityLog.findMany({
    where: {
      OR: [
        { entity: 'Customer', entityId: customer.id },
        { entity: 'CostCalculation', entityId: { in: customer.costCalculations.map(c => c.id) } },
        { entity: 'Quote', entityId: { in: quotes.map(q => q.id) } },
        { entity: 'Contract', entityId: { in: contracts.map(c => c.id) } },
        { entity: 'ContractItem', entityId: { in: contractItems.map(ci => ci.id) } },
        { entity: 'Payment', entityId: { in: payments.map(p => p.id) } },
      ],
    },
    include: { user: { select: { displayName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <div className="flex flex-col gap-5">
      <FormPageHeader
        backHref="/musteriler"
        backLabel="Müşteri listesine dön"
        title={customer.name}
        badges={
          <Badge className={CUSTOMER_DURUM_COLORS[customer.durum] || ''}>
            {CUSTOMER_DURUM_LABELS[customer.durum] || customer.durum}
          </Badge>
        }
        description={[customer.company, customer.phone].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            <Button size="sm" asChild>
              <Link href={`/maliyet/yeni?customerId=${customer.id}`}>
                <Plus className="h-4 w-4" />
                Teklif Oluştur
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/musteriler/${customer.id}/duzenle`}>Düzenle</Link>
            </Button>
            <DeleteCustomerDialog customerId={customer.id} customerName={customer.name} hasCostCalculations={customer.costCalculations.length > 0} />
          </>
        }
      />

      {/* Durum + sıradaki adım — daha önce burada 4 ayrı blok vardı (süreç kartı,
          iş kalemleri kartı, taş uyarısı, 3 ödeme kartı) ve kullanıcı sekmelere
          inmeden önce hepsini geçmek zorundaydı. Tek şeride indirildi. */}
      <div className="rounded-[var(--radius)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CustomerSurecIndicator surec={customer.surec} />
          <SurecAdvanceButton customerId={customer.id} currentSurec={customer.surec} customerName={customer.name} />
        </div>

        {(acikIsSayisi > 0 || stonesSummary.pending.length > 0 || totalGecikti > 0 || totalBekleniyor > 0) && (
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-3 text-sm">
            {acikIsSayisi > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-2.5 py-1">
                <ClipboardList className="h-3.5 w-3.5" /> {acikIsSayisi} açık iş
              </span>
            )}
            {totalGecikti > 0 && (
              <Link href="#finans" className="inline-flex items-center gap-1.5 rounded-lg bg-rose-100 px-2.5 py-1 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="h-3.5 w-3.5" /> Geciken {formatCurrency(totalGecikti)}
              </Link>
            )}
            {totalBekleniyor > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                Bekleyen {formatCurrency(totalBekleniyor)}
              </span>
            )}
            {stonesSummary.pending.length > 0 && (
              <Link
                href={`/tas-takibi?tab=satin_alinacak&q=${encodeURIComponent(customer.name)}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-100 px-2.5 py-1 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300"
              >
                <Gem className="h-3.5 w-3.5" /> {stonesSummary.pending.length} taş satın alınacak
              </Link>
            )}
          </div>
        )}
      </div>


      <Tabs defaultValue="ozet">
        <TabsList>
          <TabsTrigger value="ozet">Özet</TabsTrigger>
          <TabsTrigger value="isler">
            İşler
            {(quotes.length + contracts.length) > 0 && (
              <span className="ml-1.5 rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-xs">
                {quotes.length + contracts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="finans">
            Finans
            {payments.length > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                {payments.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ÖZET — kim bu müşteri, ona ne yapılmış */}
        <TabsContent value="ozet" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Müşteri Bilgileri</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Ad</dt>
                  <dd className="mt-1">{customer.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Firma</dt>
                  <dd className="mt-1">{customer.company ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Telefon</dt>
                  <dd className="mt-1">{customer.phone ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">E-posta</dt>
                  <dd className="mt-1">{customer.email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Vergi Numarası</dt>
                  <dd className="mt-1">{customer.vergiNumarasi ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Kaynak</dt>
                  <dd className="mt-1">
                    {customer.kaynak ? (
                      <span className="flex items-center gap-2">
                        <Badge variant="outline">{CUSTOMER_KAYNAK_LABELS[customer.kaynak] || customer.kaynak}</Badge>
                        {customer.kaynak === "referans" && customer.referansAdi && (
                          <span className="text-sm text-muted-foreground">({customer.referansAdi})</span>
                        )}
                      </span>
                    ) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">İlgilenen Personel</dt>
                  <dd className="mt-1">{customer.ilgilenenPersonel ?? "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-muted-foreground">Adres</dt>
                  <dd className="mt-1">{customer.address ?? "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-muted-foreground">Notlar</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{customer.notes ?? "—"}</dd>
                </div>
              </dl>
              <Separator className="my-4" />
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Oluşturulma: {new Date(customer.createdAt).toLocaleDateString("tr-TR")}</span>
                <span>Güncelleme: {new Date(customer.updatedAt).toLocaleDateString("tr-TR")}</span>
              </div>
            </CardContent>
          </Card>
        
          <Card>
            <CardHeader>
              <CardTitle>Geçmiş — Bu Müşteriye Ne Yapıldı</CardTitle>
            </CardHeader>
            <CardContent>
              {activityLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Henüz işlem kaydı yok.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Kullanıcı</TableHead>
                      <TableHead>İşlem</TableHead>
                      <TableHead>Kayıt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString('tr-TR', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>{log.user?.displayName ?? '—'}</TableCell>
                        <TableCell>
                          <Badge className={ACTIVITY_ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-700 dark:text-muted-foreground'}>
                            {ACTIVITY_ACTION_LABELS[log.action] ?? log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {ACTIVITY_ENTITY_LABELS[log.entity] ?? log.entity}
                          {log.entityId != null && (
                            <span className="text-muted-foreground"> #{log.entityId}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        
        </TabsContent>

        {/* İŞLER — kalemler, sözleşme, teklif, maliyet, taşlar */}
        <TabsContent value="isler" className="space-y-4">
          {contractItems.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  İş Kalemleri ({contractItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {contractItems.map((item, index) => (
                  <div key={item.id} className="flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-semibold text-muted-foreground dark:text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.yapilacakIs}</p>
                        <Link href={`/sozlesmeler/${item.contract.id}`} className="text-xs text-muted-foreground hover:underline">
                          {item.contract.contractNumber}
                        </Link>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      {item.scheduledDate && (
                        <span className="text-xs text-muted-foreground">
                          Planlanan: {new Date(item.scheduledDate).toLocaleDateString('tr-TR')}
                        </span>
                      )}
                      <Badge className={CONTRACT_ITEM_STATUS_COLORS[item.status] || ''}>
                        {CONTRACT_ITEM_STATUS_LABELS[item.status] || item.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>Sözleşmeler</CardTitle></CardHeader>
            <CardContent>
              {contracts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Bu müşterinin henüz sözleşmesi yok.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sözleşme No</TableHead>
                      <TableHead>Yapılacak İş</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead className="text-right">Tutar</TableHead>
                      <TableHead className="text-right">Ödenen</TableHead>
                      <TableHead className="text-right">Kalan</TableHead>
                      <TableHead className="text-right">Tarih</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link href={`/sozlesmeler/${c.id}`} className="font-medium hover:underline">
                            {c.contractNumber}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            <Link href={`/teklifler/${c.quoteId}`} className="hover:underline">{c.quoteNumber}</Link>
                            {c.itemCount > 0 && <span> · {c.itemCount} kalem</span>}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate">{c.yapilacakIs ?? '—'}</TableCell>
                        <TableCell>
                          <Badge className={CONTRACT_STATUS_COLORS[c.status] || ''}>
                            {CONTRACT_STATUS_LABELS[c.status] || c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(c.totalAmount)}</TableCell>
                        <TableCell className="text-right text-green-700">{formatCurrency(c.paidAmount)}</TableCell>
                        <TableCell className="text-right text-yellow-700">{formatCurrency(c.pendingAmount)}</TableCell>
                        <TableCell className="text-right">
                          {new Date(c.signatureDate).toLocaleDateString('tr-TR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        
          <Card>
            <CardHeader><CardTitle>Teklifler</CardTitle></CardHeader>
            <CardContent>
              {quotes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Bu müşteri için henüz teklif yok.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Teklif No</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead className="text-right">Toplam</TableHead>
                      <TableHead className="text-right">Tarih</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotes.map((quote) => (
                      <TableRow key={quote.id}>
                        <TableCell>
                          <Link href={`/teklifler/${quote.id}`} className="font-medium hover:underline">{quote.quoteNumber}</Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[quote.status]}>{STATUS_LABELS[quote.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(quote.toplam)}</TableCell>
                        <TableCell className="text-right">{new Date(quote.createdAt).toLocaleDateString("tr-TR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        
          <Card>
            <CardHeader><CardTitle>Maliyet Hesapları</CardTitle></CardHeader>
            <CardContent>
              {customer.costCalculations.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Bu müşteri için henüz maliyet hesabı yok.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Başlık</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead className="text-right">Karlı Toplam</TableHead>
                      <TableHead className="text-right">Tarih</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customer.costCalculations.map((cc) => (
                      <TableRow key={cc.id}>
                        <TableCell>
                          <Link href={`/maliyet/${cc.id}`} className="font-medium hover:underline">{cc.title}</Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_COLORS[cc.status]}>{STATUS_LABELS[cc.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(cc.karliToplam)}</TableCell>
                        <TableCell className="text-right">{new Date(cc.createdAt).toLocaleDateString("tr-TR")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        
          <div className="space-y-4">
            {/* Satın Alınacak */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Satın Alınacak Taşlar</CardTitle>
                  {stonesSummary.pending.length > 0 && (
                    <Badge variant="warning">
                      {stonesSummary.pending.length} bekliyor
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {stonesSummary.pending.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Bekleyen taş yok.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marka</TableHead>
                        <TableHead>Renk</TableHead>
                        <TableHead>Adet</TableHead>
                        <TableHead>Geleceği Yer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stonesSummary.pending.map((stone) => (
                        <TableRow key={stone.id}>
                          <TableCell className="font-medium">{stone.marka ?? '—'}</TableCell>
                          <TableCell>{stone.renk ?? '—'}</TableCell>
                          <TableCell>{stone.adet ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{stone.gelecekYer ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Satılan Taşlar */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Satılan Taşlar</CardTitle>
              </CardHeader>
              <CardContent>
                {stonesSummary.sold.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Satılan taş kaydı yok.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marka</TableHead>
                        <TableHead>Renk</TableHead>
                        <TableHead>Adet</TableHead>
                        <TableHead>Stok</TableHead>
                        <TableHead>Kalan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stonesSummary.sold.map((stone) => (
                        <TableRow key={stone.id}>
                          <TableCell className="font-medium">{stone.marka ?? '—'}</TableCell>
                          <TableCell>{stone.renk ?? '—'}</TableCell>
                          <TableCell>{stone.adet ?? '—'}</TableCell>
                          <TableCell>{stone.stok ?? '—'}</TableCell>
                          <TableCell>{stone.kalan ?? '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <div className="text-center">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/tas-takibi?q=${encodeURIComponent(customer.name)}`}>
                  <Gem className="h-3.5 w-3.5 mr-2" />
                  Stok Kontrol&apos;de Aç
                </Link>
              </Button>
            </div>
          </div>
        
        </TabsContent>

        {/* FİNANS */}
        <TabsContent value="finans" className="space-y-4">
          {payments.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <Card><CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground">Bekleyen</p>
                <p className="text-xl font-bold text-yellow-700">{formatCurrency(totalBekleniyor)}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground">Alınan</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(totalAlindi)}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground">Geciken</p>
                <p className="text-xl font-bold text-red-700">{formatCurrency(totalGecikti)}</p>
              </CardContent></Card>
            </div>
          )}
          <Card>
            <CardHeader><CardTitle>Ödemeler</CardTitle></CardHeader>
            <CardContent>
              <PaymentList
                payments={payments}
                customerId={customer.id}
                contractOptions={contractOptions}
              />
            </CardContent>
          </Card>
        
        </TabsContent>
      </Tabs>
    </div>
  )
}
