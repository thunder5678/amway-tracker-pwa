// Source artwork for app icons (no text, so rasterization is font-independent).
export function iconSvg({ maskable = false, rounded = true } = {}) {
  const r = rounded && !maskable ? 112 : 0
  // content scaled into the maskable safe zone when needed
  const s = maskable ? 0.72 : 0.86, t = (512 - 512 * s) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4A80BD"/><stop offset="1" stop-color="#2D5B91"/></linearGradient></defs>
  <rect width="512" height="512" rx="${r}" fill="url(#g)"/>
  <g transform="translate(${t} ${t}) scale(${s})">
    <rect x="96" y="276" width="70" height="140" rx="16" fill="#D5E3FF"/>
    <rect x="221" y="196" width="70" height="220" rx="16" fill="#FFFFFF"/>
    <rect x="346" y="116" width="70" height="300" rx="16" fill="#D3EBE3"/>
    <circle cx="131" cy="160" r="46" fill="none" stroke="#FFDBCF" stroke-width="22"/>
    <path d="M118 160l10 10 20-22" fill="none" stroke="#FFDBCF" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`
}
