/**
 * Phone photos are often 4 to 12 MB. Shrink to a readable size before upload
 * so we stay well under request limits and the vision call stays fast.
 */
export async function prepareReceiptImage(
  file: File,
  maxDim = 1600,
  quality = 0.85,
): Promise<{ base64: string; mediaType: "image/jpeg"; previewUrl: string }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't process images.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return {
    base64: dataUrl.split(",")[1],
    mediaType: "image/jpeg",
    previewUrl: dataUrl,
  };
}
