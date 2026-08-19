import { v2 as cloudinary } from 'cloudinary'
import { cloudinaryConfigured, env } from '../config/env.js'
import { AppError } from './AppError.js'

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  })
}

export interface StoredImage {
  publicId: string
  version: number
}

/*
  An eager 256x256 face-aware crop at upload time, rather than transforming on the fly at render
  time. The free tier bills transformations per thousand, and building transform URLs inside a
  list render burns that quota fast. One transform per upload, reused forever.
*/
export async function uploadAvatar(buffer: Buffer, userId: string): Promise<StoredImage> {
  if (!cloudinaryConfigured) {
    throw new AppError('INTERNAL', 'Image uploads are not configured on this deployment')
  }

  const result = await new Promise<{ public_id: string; version: number }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'r4u/avatars',
        public_id: userId,
        overwrite: true,
        invalidate: true,
        resource_type: 'image',
        transformation: [{ width: 256, height: 256, crop: 'fill', gravity: 'face' }],
      },
      (error, uploaded) => {
        if (error || !uploaded) return reject(error ?? new Error('upload failed'))
        resolve({ public_id: uploaded.public_id, version: uploaded.version })
      }
    )
    stream.end(buffer)
  })

  return { publicId: result.public_id, version: result.version }
}

export async function deleteAvatar(publicId: string): Promise<void> {
  if (!cloudinaryConfigured || !publicId) return
  await cloudinary.uploader.destroy(publicId, { invalidate: true })
}
