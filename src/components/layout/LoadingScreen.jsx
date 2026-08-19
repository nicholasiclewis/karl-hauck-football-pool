/**
 * The full-screen wait shown while the app works out who is signed in.
 *
 * Both route guards need it and they need to agree: a visitor who sees one
 * spinner turn into a different spinner has been told something changed when
 * nothing did.
 */
export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="text-4xl animate-bounce">🏈</span>
        <p className="text-muted text-sm">Loading...</p>
      </div>
    </div>
  )
}
