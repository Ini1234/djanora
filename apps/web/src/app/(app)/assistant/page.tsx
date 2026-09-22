import { Suspense } from 'react'
import { AssistantClient } from './assistant-client'

export default function AssistantPage() {
  return (
    <Suspense fallback={null}>
      <AssistantClient />
    </Suspense>
  )
}
