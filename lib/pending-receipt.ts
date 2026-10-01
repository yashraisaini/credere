/**
 * Hand a photo from the group screen's camera button to the add-expense
 * screen without a round trip. Lives in memory only.
 */
let pending: File | null = null;

export function setPendingReceipt(file: File) {
  pending = file;
}

export function takePendingReceipt(): File | null {
  const f = pending;
  pending = null;
  return f;
}
