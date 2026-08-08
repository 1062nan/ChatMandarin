'use client'

import { useEffect, useState } from 'react'

/**
 * 麦克风权限状态 hook
 * - granted: 已授权
 * - denied: 已拒绝（用户必须手动到 site settings 改）
 * - prompt: 还没问过，会弹权限请求
 * - unsupported: 浏览器不支持 Permissions API for microphone
 */
export type MicPermissionState =
  | 'granted'
  | 'denied'
  | 'prompt'
  | 'unsupported'
  | 'checking'

export function useMicPermission(): MicPermissionState {
  const [state, setState] = useState<MicPermissionState>('checking')

  useEffect(() => {
    let mounted = true

    async function check() {
      // 一些浏览器（Firefox/Safari）不支持 microphone permissions API
      if (!navigator.permissions || typeof navigator.permissions.query !== 'function') {
        if (mounted) setState('unsupported')
        return
      }

      try {
        const result = await navigator.permissions.query({
          name: 'microphone' as PermissionName,
        })
        if (mounted) setState(result.state as MicPermissionState)

        result.onchange = () => {
          if (mounted) setState(result.state as MicPermissionState)
        }
      } catch {
        if (mounted) setState('unsupported')
      }
    }

    check()
    return () => {
      mounted = false
    }
  }, [])

  return state
}

/**
 * 主动触发一次权限请求（用于 "Test microphone" 按钮）
 */
export async function requestMicPermission(): Promise<MicPermissionState> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    return 'granted'
  } catch (err) {
    const msg = (err as Error)?.message || ''
    if (msg.includes('denied') || msg.includes('NotAllowed')) return 'denied'
    if (msg.includes('NotFound')) return 'prompt' // 没设备但不能用权限判断
    return 'denied'
  }
}
