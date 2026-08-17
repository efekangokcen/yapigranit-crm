import { existsSync } from 'fs'
import path from 'path'

// Railway'de /data yoluna kalıcı bir Volume bağlı — konteyner her yeniden
// başladığında (her deploy'da) silinen public/ klasörünün aksine bu dizin
// kalıcıdır. Yerel geliştirmede /data olmadığından public/uploads'a düşer.
export function getUploadDir() {
  return existsSync('/data') ? path.join('/data', 'uploads') : path.join(process.cwd(), 'public', 'uploads')
}
