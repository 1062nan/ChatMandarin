import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-vermilion/10">
        <span className="cn-font text-4xl font-bold text-vermilion">404</span>
      </div>
      <h1 className="mb-2 text-2xl font-bold">Page not found</h1>
      <p className="mb-6 text-muted-foreground">
        页面不存在 / The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link href="/dashboard">
        <Button variant="primary">Back to Dashboard</Button>
      </Link>
    </div>
  )
}
