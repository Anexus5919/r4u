import multer from 'multer'
import { AppError } from './AppError.js'

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024

/*
  memoryStorage, never diskStorage. Render's filesystem is ephemeral and wiped on every deploy
  and spin-down, so a file written to disk is gone before anyone asks for it. The buffer streams
  straight to Cloudinary.
*/
export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1, fields: 2 },
  fileFilter(_req, file, callback) {
    // a first pass only. the declared type is a claim, and sniffImage is what actually decides
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
      callback(new AppError('VALIDATION_FAILED', 'Upload a JPEG, PNG or WebP image'))
      return
    }
    callback(null, true)
  },
}).single('avatar')

export type ImageKind = 'jpeg' | 'png' | 'webp'

/*
  The client-supplied mimetype is not evidence. A caller can label anything image/png, so the
  leading bytes are what decide, and anything unrecognised is refused.
*/
export function sniffImage(buffer: Buffer): ImageKind | null {
  if (buffer.length < 12) return null

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg'

  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (PNG.every((byte, index) => buffer[index] === byte)) return 'png'

  // RIFF....WEBP
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp'
  }

  return null
}
