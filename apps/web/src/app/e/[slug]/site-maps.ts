export function mapsSearchUrl(address: string) {
  const q = encodeURIComponent(address.trim())
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
    apple: `https://maps.apple.com/?q=${q}`,
    embed: `https://maps.google.com/maps?q=${q}&output=embed`,
  }
}
