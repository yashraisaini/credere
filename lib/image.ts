/**
 * Getting whatever the user picked into something the vision API can read.
 *
 * Three paths. A PDF goes up untouched, because the model reads PDFs natively
 * and rasterising one here would only lose text. A HEIC the browser refuses to
 * open also goes up untouched, since the model reads HEIC even where Chrome
 * cannot. Everything else is decoded by the browser and re-encoded as a modest
 * JPEG, which means we accept any format the browser can open (PNG, WebP,
 * AVIF, GIF, BMP) without the server needing to know about any of them.
 */

export type PreparedReceipt = {
  kind: "image" | "pdf";
  base64: string;
  mediaType: string;
  /** Null when there is nothing the browser could render as a thumbnail. */
  previewUrl: string | null;
};

/** The API caps a request at 32MB; stay well under it. */
const MAX_PDF_BYTES = 12 * 1024 * 1024;

export async function prepareReceipt(
  file: File,
  maxDim = 1600,
  quality = 0.85,
): Promise<PreparedReceipt> {
  if (isPdf(file)) {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error("That PDF is too large. Try a single page, or a photo of the receipt.");
    }
    return { kind: "pdf", base64: await fileToBase64(file), mediaType: "application/pdf", previewUrl: null };
  }

  let decoded: Decoded;
  try {
    decoded = await decode(file);
  } catch (e) {
    // The model reads HEIC even where this browser can't, so rather than
    // refusing an iPhone photo outright, send the original bytes up.
    const heic = heicType(file);
    if (heic) {
      return { kind: "image", base64: await fileToBase64(file), mediaType: heic, previewUrl: null };
    }
    throw e;
  }

  try {
    const scale = Math.min(1, maxDim / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser can't process images.");
    // White underneath, so a transparent PNG doesn't come out as black paper.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(decoded.source, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return {
      kind: "image",
      base64: dataUrl.split(",")[1],
      mediaType: "image/jpeg",
      previewUrl: dataUrl,
    };
  } finally {
    decoded.release();
  }
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

/**
 * createImageBitmap handles most things and is the fast path. Where it refuses,
 * an <img> often still decodes the file, which is what rescues HEIC on Safari.
 */
async function decode(file: File): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  } catch {
    // fall through to the <img> path
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(unreadable(file)));
      img.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/** The media type to send for a HEIC/HEIF file, or null if it isn't one. */
function heicType(file: File): string | null {
  if (/heic/i.test(file.type)) return "image/heic";
  if (/heif/i.test(file.type)) return "image/heif";
  if (/\.heic$/i.test(file.name)) return "image/heic";
  if (/\.heif$/i.test(file.name)) return "image/heif";
  return null;
}

function unreadable(file: File): string {
  if (heicType(file)) return "Couldn't open that photo.";
  return "That file isn't an image this browser can open. Try a JPEG, PNG or PDF.";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}
