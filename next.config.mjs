/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 关键：让 ws 及其可选依赖不被 webpack 打包，直接 require
  // 否则 ws 库内部的 mask/unmask 函数会丢失，导致 "t.mask is not a function"
  experimental: {
    serverComponentsExternalPackages: ['ws', 'bufferutil', 'utf-8-validate'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.chatmandarin.cc' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' }
    ]
  }
}

export default nextConfig
