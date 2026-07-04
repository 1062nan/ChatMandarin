'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, Mail, Lock, User } from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const signupSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().email('Please enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
})

type SignupValues = z.infer<typeof signupSchema>

export function SignupForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const supabase = getSupabaseClient()

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema)
  })

  async function onSubmit(values: SignupValues) {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            display_name: values.displayName
          }
        }
      })

      if (error) throw error

      // 更新 display_name 到 profile（trigger 会自动创建 profile，但 display_name 需要手动更新）
      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ display_name: values.displayName })
          .eq('auth_id', data.user.id)

        if (profileError) console.warn('Profile update deferred:', profileError)
      }

      // 检查是否需要邮箱验证
      if (data.session === null) {
        toast.success('Account created! Please check your email to verify your account.')
        router.push('/login?verified=pending')
      } else {
        toast.success('Welcome to ChatMandarin!')
        router.push('/dashboard')
        router.refresh()
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to sign up')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="displayName"
            type="text"
            placeholder="Tom Smith"
            className="pl-9"
            disabled={isLoading}
            {...register('displayName')}
          />
        </div>
        {errors.displayName && (
          <p className="text-sm text-destructive">{errors.displayName.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            className="pl-9"
            disabled={isLoading}
            {...register('email')}
          />
        </div>
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="password"
            type="password"
            placeholder="At least 8 characters"
            className="pl-9"
            disabled={isLoading}
            {...register('password')}
          />
        </div>
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        Create account
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        By signing up, you agree to our Terms of Service and Privacy Policy.
      </p>
    </form>
  )
}
