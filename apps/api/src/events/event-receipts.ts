export function receiptProxyUrl(eventId: string, itemId: string, receiptId: string) {
  return `/api/proxy/events/${eventId}/budget/${itemId}/receipts/${receiptId}/file`
}

export function rewriteReceiptUrls<
  T extends { id: string; receipts?: { id: string; url: string }[] },
>(eventId: string, items: T[]): T[] {
  return items.map((item) => ({
    ...item,
    receipts: (item.receipts ?? []).map((receipt) => ({
      ...receipt,
      url: receiptProxyUrl(eventId, item.id, receipt.id),
    })),
  }))
}
