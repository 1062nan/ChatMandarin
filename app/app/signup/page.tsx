import Link from 'next/link'
import { SignupForm } from '@/components/auth/signup-form'

export const metadata = {
  title: 'Create account'
}

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-block">
          <img src="/logo.svg" alt="ChatMandarin" className="mx-auto h-10 w-auto" />
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Start speaking Mandarin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Free forever for 5 minutes a day. No credit card required.
        </p>
      </div>

      <div className="space-y-6">
        <SignupForm />

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-vermilion hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
