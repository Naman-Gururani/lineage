/** Decorative CRT overlay: scanlines + vignette. Purely cosmetic. */
export function Crt() {
  return (
    <div className="crt" aria-hidden="true">
      <div className="crt-scan" />
      <div className="crt-vignette" />
    </div>
  )
}
