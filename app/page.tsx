import { Suspense } from 'react'
import { QcApp } from '@/components/qc-app'

export default function HomePage() {
  return (
    <Suspense fallback={<main className="shell"><p className="muted">Loading…</p></main>}>
      <QcApp />
    </Suspense>
  )
}
