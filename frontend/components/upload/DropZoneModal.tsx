'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Upload, X, FileText } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useUploadContract } from '@/lib/api'
import { Button } from '@/components/ui/Button'

const DEMO_PRESETS = [
  {
    label: 'Predatory Rental Agreement',
    filename: 'predatory-rental.txt',
    tag: 'Rental',
    text: `RENTAL AGREEMENT

Landlord: ABC Properties LLC
Tenant: [TENANT NAME]
Property: 123 Main Street, Unit 4B
Rent: $2,500/month due on 1st

UNLIMITED LIABILITY CLAUSE: Tenant shall be liable for ALL damages to the property, regardless of cause, including acts of God, building defects, and normal wear and tear. Tenant waives all rights to seek remedies under local tenant protection laws.

TERMINATION: Landlord may terminate this lease immediately without notice for any reason. Tenant must vacate within 24 hours or face $500/day penalty.

IP CLAUSE: Any improvements made by tenant to the property become permanent fixtures and property of the landlord without compensation.

GOVERNING LAW: This agreement shall be governed exclusively by the laws of the Landlord's choosing, which may change at any time.

CONFIDENTIALITY: Tenant agrees never to discuss the terms of this agreement or any disputes with any third party, including attorneys, for a period of UNLIMITED duration.`,
  },
  {
    label: 'Restrictive Employment Offer',
    filename: 'employment-offer.txt',
    tag: 'Employment',
    text: `EMPLOYMENT AGREEMENT

Employer: TechCorp Inc.
Employee: [EMPLOYEE NAME]
Position: Software Engineer
Salary: $120,000/year

IP ASSIGNMENT: Employee hereby irrevocably assigns to Employer ALL intellectual property created at any time, including work done on personal time, personal projects, and prior inventions not disclosed in the Excluded Inventions Schedule.

NON-COMPETE: Employee shall not work for any company that could be considered competitive with Employer for a period of 5 years in any country where Employer has or may have operations.

TERMINATION: Employer may terminate employment at will, immediately, without severance. Employee must provide 90 days written notice or forfeit final paycheck.

ARBITRATION: All disputes must be settled through mandatory binding arbitration in [Employer's chosen city], employee waives right to class action or jury trial.

GOVERNING LAW: Delaware.`,
  },
  {
    label: 'Freelance IP Assignment',
    filename: 'freelance-contract.txt',
    tag: 'Freelance',
    text: `FREELANCE SERVICES AGREEMENT

Client: StartupXYZ
Freelancer: [FREELANCER NAME]
Project: Website Redesign
Fee: $5,000 total

IP OWNERSHIP: All work product, source code, designs, and materials created under this agreement are works-for-hire and immediately become sole property of Client. Freelancer waives all moral rights and retains no license to display work in portfolio.

UNLIMITED REVISIONS: Freelancer must perform unlimited revisions until Client is "fully satisfied" at no additional charge.

PAYMENT: Payment is due within 90 days of project completion, subject to Client's approval. Client may withhold payment indefinitely if dissatisfied.

LIABILITY: Freelancer shall indemnify Client for any and all claims, including claims arising from Client's own negligence.

NON-SOLICITATION: Freelancer may not solicit any of Client's customers or employees for 3 years globally.`,
  },
]

export function DropZoneModal() {
  const open = useAppStore((s) => s.uploadModalOpen)
  const setOpen = useAppStore((s) => s.setUploadModalOpen)
  const router = useRouter()
  const upload = useUploadContract()
  const [file, setFile] = useState<File | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt'],
      'application/rtf': ['.rtf'],
      'text/rtf': ['.rtf'],
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
  })

  const handleUpload = async () => {
    if (!file) return
    try {
      const contract = await upload.mutateAsync(file)
      toast.success('Contract uploaded! Analysis starting...')
      setOpen(false)
      setFile(null)
      router.push(`/analyze/${contract.id}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Upload failed. Please try again.')
    }
  }

  const handleClose = () => {
    setOpen(false)
    setFile(null)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-lg bg-bg-surface border border-white/[0.08] rounded-2xl p-6 shadow-2xl"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">Analyze a Contract</h2>
                <p className="text-text-secondary text-sm mt-0.5">PDF, DOCX, or TXT — up to 20MB</p>
              </div>
              <button onClick={handleClose} className="text-text-muted hover:text-text-secondary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drop zone */}
            <div
              {...getRootProps()}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                isDragActive
                  ? 'border-gold bg-gold/5 shadow-[0_0_20px_rgba(232,197,71,0.15)]'
                  : file
                  ? 'border-safe/50 bg-safe/5'
                  : 'border-white/10 hover:border-white/20 hover:bg-bg-elevated'
              }`}
            >
              <input {...getInputProps()} />

              <AnimatePresence mode="wait">
                {file ? (
                  <motion.div
                    key="file"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div className="w-12 h-12 bg-safe/10 border border-safe/20 rounded-xl flex items-center justify-center mx-auto">
                      <FileText className="w-6 h-6 text-safe" />
                    </div>
                    <div>
                      <p className="text-text-primary font-medium text-sm">{file.name}</p>
                      <p className="text-text-secondary text-xs mt-1">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null) }}
                      className="text-xs text-text-muted hover:text-danger transition-colors"
                    >
                      Remove file
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-3"
                  >
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto transition-all ${isDragActive ? 'bg-gold/20 border-gold/40' : 'bg-bg-elevated border-white/10'} border`}>
                      <Upload className={`w-7 h-7 ${isDragActive ? 'text-gold' : 'text-text-muted'}`} />
                    </div>
                    <div>
                      <p className="text-text-primary font-medium">
                        {isDragActive ? 'Drop it here!' : 'Drag & drop your contract'}
                      </p>
                      <p className="text-text-secondary text-sm mt-1">or click to browse</p>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      {['PDF', 'DOCX', 'TXT'].map(ext => (
                        <span key={ext} className="text-xs bg-bg-elevated border border-white/[0.06] rounded px-2 py-0.5 text-text-muted font-mono">
                          .{ext.toLowerCase()}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Upload button */}
            <div className="mt-4 flex gap-3">
              <Button variant="ghost" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="gold"
                onClick={handleUpload}
                disabled={!file}
                loading={upload.isPending}
                className="flex-1"
              >
                {upload.isPending ? 'Uploading...' : 'Analyze Contract →'}
              </Button>
            </div>

            {/* Demo presets */}
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <p className="text-text-muted text-[11px] uppercase tracking-widest font-mono mb-2">Try a Demo Contract</p>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      // Create a synthetic text file from the demo contract
                      const blob = new Blob([preset.text], { type: 'text/plain' })
                      const f = new File([blob], preset.filename, { type: 'text/plain' })
                      setFile(f)
                    }}
                    className="text-left text-[11px] bg-bg-elevated border border-white/[0.06] rounded-lg px-2.5 py-2 hover:border-gold/20 hover:bg-gold/5 transition-all"
                  >
                    <span className="block text-gold font-medium text-[10px] uppercase tracking-wide mb-0.5">{preset.tag}</span>
                    <span className="text-text-secondary line-clamp-2">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <p className="text-center text-text-muted text-xs mt-4">
              Analysis takes 30-60 seconds. Your file is processed securely.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
