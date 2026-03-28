/**
 * R2 helpers.
 * Note: R2 has no image transformation — compress client-side before upload.
 * Presigned URLs use the Workers-native R2 signing approach (not S3 SDK).
 */

export type UploadedFile = {
  key: string;
  url: string;
  size: number;
  contentType: string;
};

export async function getFile(
  bucket: R2Bucket,
  key: string
): Promise<R2ObjectBody | null> {
  return bucket.get(key);
}

export async function deleteFile(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}

export async function listFiles(
  bucket: R2Bucket,
  prefix: string
): Promise<R2Object[]> {
  const result = await bucket.list({ prefix });
  return result.objects;
}

/**
 * Build a public-facing URL for a file (served via /api/upload/:key).
 * For presigned R2 public access, configure a custom domain on the bucket.
 */
export function getFileUrl(appUrl: string, key: string): string {
  return `${appUrl}/api/upload/${key}`;
}
