'use client'

import { useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils/cn'
import {
  useMicPermission,
  requestMicPermission,
  type MicPermissionState,
} from '@/lib/hooks/use-mic-permission'

interface Props {
  className?: string
}

/**
 * 麦克风权限提示横幅
 * - denied 时显示醒目的红色警告，告知用户怎么去 site settings 改
 * - prompt 时显示"点击授权"按钮，主动触发 getUserMedia
 * - granted / unsupported 时不显示
 */
export function MicPermissionBanner({ className }: Props) {
  const perm = useMicPermission()
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<MicPermissionState | null>(null)

  if (perm === 'granted' || perm === 'unsupported' || perm === 'checking') {
    return null
  }

  // 用户手动测过的状态
  const effective = result || perm

  if (effective === 'granted') {
    return (
      <Card className={cn('border-jade/40 bg-jade/5', className)}>
        <CardContent className="flex items-center gap-3 p-3">
          <span className="text-sm">✓ 麦克风权限已授权</span>
        </CardContent>
      </Card>
    )
  }

  async function handleTest() {
    setTesting(true)
    const r = await requestMicPermission()
    setResult(r)
    setTesting(false)
  }

  return (
    <Card className={cn('border-vermilion/40 bg-vermilion/5', className)}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-vermilion" />
          <div className="text-sm">
            {effective === 'denied' ? (
              <>
                <p className="font-medium text-vermilion">麦克风权限被拒绝</p>
                <p className="mt-1 text-muted-foreground">
                  请点击浏览器地址栏最左侧的 🔒 / 麦克风 图标，把麦克风权限改为
                  <strong>「允许」</strong>，然后刷新页面。
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Chrome: 地址栏左侧图标 → 网站设置 → 麦克风 → 允许
                  <br />
                  Safari: 偏好设置 → 网站 → 麦克风
                  <br />
                  Edge: 地址栏左侧图标 → 网站权限 → 麦克风
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">麦克风权限未授权</p>
                <p className="mt-1 text-muted-foreground">
                  点击下方按钮授权麦克风，才能开始录音练习。
                </p>
              </>
            )}
          </div>
        </div>
        {effective !== 'denied' && (
          <Button
            onClick={handleTest}
            disabled={testing}
            size="sm"
            variant="outline"
            className="self-start"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', testing && 'animate-spin')} />
            {testing ? '请求中...' : '授权麦克风'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
