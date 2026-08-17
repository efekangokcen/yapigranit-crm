'use client'

import { useReducer, useCallback } from 'react'
import {
  calcNetIsM2,
  calcFiyatTrBase,
  calcQuoteItemPrices,
  calcExtraTutar,
} from '@/lib/calculations/quote-engine'

export type QuotePriceBasis = 'karli' | 'kdv_yedirilmis' | 'kdvli'

export interface QuoteItemState {
  id: string
  yapilacakIs: string
  tasCinsi: string
  ebat: string
  kalinlik: number
  en: number
  boy: number
  birim: 'm2' | 'mtül'
  deger: number
  miktar: number
  ikinciBirim: string
  fiyatTr: number
  tutarTr: number
}

export interface QuoteExtraState {
  id: string
  is: string
  deger: number
  miktar: number
  birim: string
  fiyat: number
  tutar: number
  maliyetDahil: boolean   // true → maliyet tutarından düşülür, false → üstüne eklenir
}

export interface QuoteState {
  costCalculationId: number
  yapilacakIs: string
  malzeme: string
  ilgiliKisi: string
  teslimat: string
  telefon: string
  mailAdresi: string
  customerNote: string
  validUntilDate: string   // ISO date string "YYYY-MM-DD"
  karliToplam: number
  priceBasis: QuotePriceBasis
  stoneMap: Record<string, number>  // "MARKA - RENK" → tasUcreti (₺/m²)
  invoiceRequested: boolean
  items: QuoteItemState[]
  extras: QuoteExtraState[]
  discount: number
  netIsM2: number
  fiyatTrBase: number   // ortalama m² fiyatı (gösterim için)
  toplam: number
  currency: 'TRY' | 'USD' | 'EUR'
  exchangeRate: number
  calculationMode?: 'auto_distribution' | 'manual_mtul'
}

type Action =
  | { type: 'SET_FIELD'; field: string; value: string | number | boolean }
  | { type: 'ADD_ITEM' }
  | { type: 'REMOVE_ITEM'; id: string }
  | { type: 'UPDATE_ITEM'; id: string; field: string; value: string | number }
  | { type: 'ADD_EXTRA' }
  | { type: 'REMOVE_EXTRA'; id: string }
  | { type: 'UPDATE_EXTRA'; id: string; field: string; value: string | number | boolean }
  | { type: 'SET_DISCOUNT'; value: number }
  | { type: 'LOAD_DATA'; data: Partial<QuoteState> }

function createEmptyItem(): QuoteItemState {
  return {
    id: crypto.randomUUID(),
    yapilacakIs: '',
    tasCinsi: '',
    ebat: '',
    kalinlik: 0,
    en: 0,
    boy: 0,
    birim: 'm2',
    deger: 0,
    miktar: 1,
    ikinciBirim: 'ADET',
    fiyatTr: 0,
    tutarTr: 0,
  }
}

function createEmptyExtra(): QuoteExtraState {
  return {
    id: crypto.randomUUID(),
    is: '',
    deger: 1,
    miktar: 1,
    birim: 'adet',
    fiyat: 0,
    tutar: 0,
    maliyetDahil: true,
  }
}

function recalculateQuote(state: QuoteState): QuoteState {
  const netIsM2 = calcNetIsM2(state.items)

  // Önce ekstra tutarlarını hesapla
  const extras = state.extras.map(extra => {
    const tutar = calcExtraTutar(extra.fiyat, extra.miktar, extra.deger)
    return { ...extra, tutar }
  })

  // Maliyet dahil ekstraları karliToplam'dan düş → kalan items'a dağıtılır
  const dahilExtrasTotal = extras
    .filter(e => e.maliyetDahil)
    .reduce((sum, e) => sum + e.tutar, 0)
  const dahilDegilExtrasTotal = extras
    .filter(e => !e.maliyetDahil)
    .reduce((sum, e) => sum + e.tutar, 0)

  // Items'a dağıtılacak tutar = karliToplam - dahil ekstralar
  const effectiveKarliToplam = Math.max(0, state.karliToplam - dahilExtrasTotal)
  const fiyatTrBase = calcFiyatTrBase(effectiveKarliToplam, netIsM2)

  // Taşa göre orantılı fiyat dağıtımı (düşülmüş tutarla)
  const priceMap = calcQuoteItemPrices(state.items, effectiveKarliToplam, state.stoneMap)

  const items = state.items.map(item => {
    const priceData = priceMap.get(item.id)
    return {
      ...item,
      deger: priceData?.deger ?? item.deger,
      fiyatTr: priceData?.fiyatTr ?? 0,
      tutarTr: priceData?.tutarTr ?? 0,
    }
  })

  const itemsTotal = items.reduce((sum, item) => sum + item.tutarTr, 0)
  // Toplam = items + tüm ekstralar (dahil olanlar items'tan düşüldü ama buraya ekleniyor → net etki sıfır)
  // Dahil değil olanlar gerçekten ek tutar
  const toplam = itemsTotal + dahilExtrasTotal + dahilDegilExtrasTotal - state.discount

  return { ...state, items, extras, netIsM2, fiyatTrBase, toplam }
}

function reducer(state: QuoteState, action: Action): QuoteState {
  switch (action.type) {
    case 'SET_FIELD':
      return recalculateQuote({ ...state, [action.field]: action.value })

    case 'ADD_ITEM':
      return recalculateQuote({
        ...state,
        items: [...state.items, createEmptyItem()],
      })

    case 'REMOVE_ITEM':
      return recalculateQuote({
        ...state,
        items: state.items.filter(i => i.id !== action.id),
      })

    case 'UPDATE_ITEM': {
      const items = state.items.map(i =>
        i.id === action.id ? { ...i, [action.field]: action.value } : i
      )
      return recalculateQuote({ ...state, items })
    }

    case 'ADD_EXTRA':
      return recalculateQuote({
        ...state,
        extras: [...state.extras, createEmptyExtra()],
      })

    case 'REMOVE_EXTRA':
      return recalculateQuote({
        ...state,
        extras: state.extras.filter(e => e.id !== action.id),
      })

    case 'UPDATE_EXTRA': {
      const extras = state.extras.map(e =>
        e.id === action.id ? { ...e, [action.field]: action.value } : e
      )
      return recalculateQuote({ ...state, extras })
    }

    case 'SET_DISCOUNT':
      return recalculateQuote({ ...state, discount: action.value })

    case 'LOAD_DATA': {
      const loadedData = { ...action.data }
      // Eski kayıtlarda maliyetDahil yoksa default true ata
      if (loadedData.extras) {
        loadedData.extras = loadedData.extras.map(e => ({
          ...e,
          maliyetDahil: (e as QuoteExtraState).maliyetDahil ?? true,
        }))
      }
      if (loadedData.items) {
        loadedData.items = loadedData.items.map(i => ({
          ...i,
          ebat: (i as QuoteItemState).ebat ?? '',
        }))
      }
      return recalculateQuote({ ...state, ...loadedData })
    }

    default:
      return state
  }
}

function createInitialState(
  costCalculationId = 0,
  karliToplam = 0,
  stoneMap: Record<string, number> = {}
): QuoteState {
  return recalculateQuote({
    costCalculationId,
    yapilacakIs: '',
    malzeme: '',
    ilgiliKisi: '',
    teslimat: '',
    telefon: '',
    mailAdresi: '',
    customerNote: '',
    validUntilDate: '',
    karliToplam,
    priceBasis: 'karli',
    stoneMap,
    invoiceRequested: false,
    items: [createEmptyItem()],
    extras: [],
    discount: 0,
    netIsM2: 0,
    fiyatTrBase: 0,
    toplam: 0,
    currency: 'TRY',
    exchangeRate: 1,
  })
}

export function useQuote(
  costCalculationId = 0,
  karliToplam = 0,
  stoneMap: Record<string, number> = {}
) {
  const [state, dispatch] = useReducer(
    reducer,
    { costCalculationId, karliToplam, stoneMap },
    ({ costCalculationId, karliToplam, stoneMap }) =>
      createInitialState(costCalculationId, karliToplam, stoneMap)
  )

  const setField = useCallback((field: string, value: string | number | boolean) => {
    dispatch({ type: 'SET_FIELD', field, value })
  }, [])

  const addItem = useCallback(() => dispatch({ type: 'ADD_ITEM' }), [])
  const removeItem = useCallback((id: string) => dispatch({ type: 'REMOVE_ITEM', id }), [])
  const updateItem = useCallback((id: string, field: string, value: string | number) => {
    dispatch({ type: 'UPDATE_ITEM', id, field, value })
  }, [])

  const addExtra = useCallback(() => dispatch({ type: 'ADD_EXTRA' }), [])
  const removeExtra = useCallback((id: string) => dispatch({ type: 'REMOVE_EXTRA', id }), [])
  const updateExtra = useCallback((id: string, field: string, value: string | number | boolean) => {
    dispatch({ type: 'UPDATE_EXTRA', id, field, value })
  }, [])

  const setDiscount = useCallback((value: number) => dispatch({ type: 'SET_DISCOUNT', value }), [])
  const loadData = useCallback((data: Partial<QuoteState>) => dispatch({ type: 'LOAD_DATA', data }), [])

  return {
    state,
    setField,
    addItem,
    removeItem,
    updateItem,
    addExtra,
    removeExtra,
    updateExtra,
    setDiscount,
    loadData,
  }
}
