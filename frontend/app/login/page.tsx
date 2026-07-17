'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/Button'

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const demoCredentials = { email: 'demo@lexguard.ai', password: 'demo1234' }

  const signIn = async (credentials = form) => {
    setError('')
    setLoading(true)
    try {
      const res = await authApi.login({ email: credentials.email, password: credentials.password })
      setAuth(res.user, res.access_token)
      // Set cookie for middleware
      document.cookie = `lexguard_token=${res.access_token}; path=/; max-age=604800; SameSite=Lax`
      toast.success(`Welcome back, ${res.user.full_name.split(' ')[0]}!`)
      router.push('/dashboard')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Invalid email or password'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    signIn()
  }

  const handleDemoLogin = () => {
    setForm(demoCredentials)
    signIn(demoCredentials)
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-mesh" />
      <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-gold/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 left-1/4 w-72 h-72 bg-blue/5 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L4 7v9c0 7 5.4 13.5 12 15 6.6-1.5 12-8 12-15V7L16 2z"
                fill="#E8C547" fillOpacity="0.15" stroke="#E8C547" strokeWidth="1.5" />
              <path d="M11 16l3 3 7-7" stroke="#E8C547" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="text-2xl font-display text-text-primary tracking-wide">LEXGUARD</span>
          </Link>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Welcome back</h1>
          <p className="text-text-secondary text-sm">Sign in to your contract intelligence dashboard</p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-danger text-sm">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="you@company.com"
                  required
                  className="w-full bg-bg-elevated border border-white/[0.08] rounded-lg pl-10 pr-4 py-2.5 text-text-primary placeholder:text-text-muted text-sm outline-none focus:border-gold/50 transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-text-secondary">Password</label>
                <span className="text-xs text-text-muted hover:text-text-secondary cursor-pointer transition-colors">
                  Forgot password?
                </span>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Your password"
                  required
                  className="w-full bg-bg-elevated border border-white/[0.08] rounded-lg pl-10 pr-10 py-2.5 text-text-primary placeholder:text-text-muted text-sm outline-none focus:border-gold/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" variant="gold" size="lg" loading={loading} className="w-full mt-2">
              {loading ? 'Signing In...' : 'Sign In →'}
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="mt-4 p-3 bg-gold/5 border border-gold/20 rounded-lg">
            <p className="text-xs text-text-secondary text-center mb-2 font-medium">Evaluator Demo Account</p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={loading}
                className="text-sm font-semibold text-bg-base bg-gold hover:bg-gold-hover disabled:opacity-60 border border-gold/20 rounded-md py-2 transition-all"
              >
                Continue with Demo
              </button>
              <p className="text-[11px] text-text-muted text-center">
                {demoCredentials.email} / {demoCredentials.password}
              </p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-text-muted text-sm">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-gold hover:text-gold-hover font-medium transition-colors">
                Create one free
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
