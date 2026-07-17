'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Eye, EyeOff, Mail, Lock, User, Shield } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui/Button'

export default function SignupPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const demoCredentials = { email: 'demo@lexguard.ai', password: 'demo1234' }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!form.full_name.trim()) errs.full_name = 'Full name is required'
    if (!form.email.includes('@')) errs.email = 'Enter a valid email'
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters'
    if (form.password !== form.confirm) errs.confirm = 'Passwords do not match'
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setLoading(true)
    try {
      const res = await authApi.register({
        email: form.email,
        full_name: form.full_name,
        password: form.password,
      })
      setAuth(res.user, res.access_token)
      document.cookie = `lexguard_token=${res.access_token}; path=/; max-age=604800; SameSite=Lax`
      toast.success(`Welcome to LexGuard, ${res.user.full_name.split(' ')[0]}!`)
      router.push('/dashboard')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Registration failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setLoading(true)
    try {
      const res = await authApi.login(demoCredentials)
      setAuth(res.user, res.access_token)
      document.cookie = `lexguard_token=${res.access_token}; path=/; max-age=604800; SameSite=Lax`
      toast.success('Demo workspace ready')
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Demo login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-mesh" />
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gold/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue/5 rounded-full blur-3xl" />

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
          <h1 className="text-2xl font-bold text-text-primary mb-2">Create your account</h1>
          <p className="text-text-secondary text-sm">Start protecting yourself from risky contracts</p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="John Smith"
                  className={`w-full bg-bg-elevated border ${errors.full_name ? 'border-danger/60' : 'border-white/[0.08]'} rounded-lg pl-10 pr-4 py-2.5 text-text-primary placeholder:text-text-muted text-sm outline-none focus:border-gold/50 transition-colors`}
                />
              </div>
              {errors.full_name && <p className="text-danger text-xs mt-1">{errors.full_name}</p>}
            </div>

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
                  className={`w-full bg-bg-elevated border ${errors.email ? 'border-danger/60' : 'border-white/[0.08]'} rounded-lg pl-10 pr-4 py-2.5 text-text-primary placeholder:text-text-muted text-sm outline-none focus:border-gold/50 transition-colors`}
                />
              </div>
              {errors.email && <p className="text-danger text-xs mt-1">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Minimum 8 characters"
                  className={`w-full bg-bg-elevated border ${errors.password ? 'border-danger/60' : 'border-white/[0.08]'} rounded-lg pl-10 pr-10 py-2.5 text-text-primary placeholder:text-text-muted text-sm outline-none focus:border-gold/50 transition-colors`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-danger text-xs mt-1">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirm}
                  onChange={(e) => setForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="Repeat your password"
                  className={`w-full bg-bg-elevated border ${errors.confirm ? 'border-danger/60' : 'border-white/[0.08]'} rounded-lg pl-10 pr-4 py-2.5 text-text-primary placeholder:text-text-muted text-sm outline-none focus:border-gold/50 transition-colors`}
                />
              </div>
              {errors.confirm && <p className="text-danger text-xs mt-1">{errors.confirm}</p>}
            </div>

            <Button type="submit" variant="gold" size="lg" loading={loading} className="w-full mt-2">
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="mb-4 w-full rounded-md border border-gold/20 bg-gold/10 py-2 text-sm font-semibold text-gold transition-all hover:bg-gold/20 hover:text-gold-hover disabled:opacity-60"
            >
              Continue with Demo
            </button>
            <p className="text-text-muted text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-gold hover:text-gold-hover font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-text-muted text-xs mt-6 leading-relaxed">
          By creating an account, you agree that LexGuard provides AI analysis for awareness purposes only,
          not as a substitute for professional legal counsel.
        </p>
      </motion.div>
    </div>
  )
}
