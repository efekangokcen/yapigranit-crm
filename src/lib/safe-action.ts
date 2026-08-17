/**
 * Güvenli ve Çökmesiz Server Action & Veritabanı Sarmalayıcısı.
 *
 * Bu modül, veritabanı veya sunucu tarafında oluşabilecek beklenmeyen tüm hataları
 * (null pointer, DB kilitlenmesi, yetki hatası) yakalar, loglar ve uygulamanın
 * çökmesini önler.
 */

export interface ActionResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Server Action fonksiyonunu çökmesiz (crash-proof) sarmalar.
 */
export async function withSafeAction<T>(
  actionFn: () => Promise<T>,
  errorMessage = 'İşlem sırasında beklenmeyen bir hata oluştu.'
): Promise<ActionResponse<T>> {
  try {
    const result = await actionFn()
    return {
      success: true,
      data: result,
    }
  } catch (err) {
    const message = (err instanceof Error && err.message) || errorMessage
    console.error('[SafeAction Guard Error]:', err)

    return {
      success: false,
      error: message,
    }
  }
}

/**
 * Geçici veritabanı kilitlenmelerinde (DB Lock / Timeout) otomatik yeniden deneme (retry) mekanizması.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 200
): Promise<T> {
  let attempt = 0
  while (attempt < retries) {
    try {
      return await fn()
    } catch (err) {
      attempt++
      if (attempt >= retries) {
        throw err
      }
      console.warn(`[DB Retry Warning] Deneme ${attempt}/${retries} başarısız oldu. ${delayMs}ms sonra tekrar deneniyor...`)
      await new Promise((res) => setTimeout(res, delayMs * attempt))
    }
  }
  throw new Error('İşlem izin verilen deneme sayısını aştı.')
}
