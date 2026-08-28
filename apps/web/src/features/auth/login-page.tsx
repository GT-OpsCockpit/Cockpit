import { useEffect, useState } from 'react'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { useNavigate } from 'react-router'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  useAuthControllerLogin,
  useAuthControllerVerify,
  getAuthControllerMeQueryKey,
} from '@cockpit/shared/api'
import { queryClient } from '@/lib/query-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Spinner } from '@/components/ui/spinner'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

// Mirrors the server's OTP_TTL_MINUTES (see apps/api/src/auth/auth.service.ts).
const OTP_TTL_SECONDS = 5 * 60

const credentialsSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
})

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
})

type Step =
  | { kind: 'credentials' }
  | { kind: 'otp'; email: string; devCode?: string }

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function LoginPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>({ kind: 'credentials' })

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-primary text-2xl">Cockpit</CardTitle>
          <CardDescription>
            {step.kind === 'credentials'
              ? 'Sign in to your dispatch account.'
              : `Enter the code we sent to ${step.email}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step.kind === 'credentials' ? (
            <CredentialsForm onCodeSent={setStep} />
          ) : (
            <OtpForm
              email={step.email}
              devCode={step.devCode}
              onBack={() => setStep({ kind: 'credentials' })}
              onVerified={() => navigate('/bookings', { replace: true })}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CredentialsForm({ onCodeSent }: { onCodeSent: (step: Step) => void }) {
  const [passwordVisible, setPasswordVisible] = useState(false)
  const form = useForm({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: '', password: '' },
  })
  const login = useAuthControllerLogin()

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await login.mutateAsync({ data: values })
      onCodeSent({ kind: 'otp', email: values.email, devCode: result.devCode })
    } catch (error) {
      form.setError('root', { message: getApiErrorMessage(error, 'Invalid email or password.') })
    }
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="grid gap-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <InputGroup>
                <FormControl>
                  <InputGroupInput
                    type={passwordVisible ? 'text' : 'password'}
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                    aria-pressed={passwordVisible}
                    onClick={() => setPasswordVisible((visible) => !visible)}
                  >
                    {passwordVisible ? <EyeOffIcon /> : <EyeIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.formState.errors.root && (
          <p className="text-destructive text-sm">{form.formState.errors.root.message}</p>
        )}
        <Button type="submit" disabled={login.isPending} className="w-full">
          {login.isPending && <Spinner />}
          {login.isPending ? 'Signing in…' : 'Continue'}
        </Button>
      </form>
    </Form>
  )
}

function OtpForm({
  email,
  devCode,
  onBack,
  onVerified,
}: {
  email: string
  devCode?: string
  onBack: () => void
  onVerified: () => void
}) {
  const form = useForm({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: devCode ?? '' },
  })
  const verify = useAuthControllerVerify()
  const [secondsLeft, setSecondsLeft] = useState(OTP_TTL_SECONDS)

  useEffect(() => {
    if (secondsLeft <= 0) return
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [secondsLeft])

  const expired = secondsLeft <= 0

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await verify.mutateAsync({ data: { email, code: values.code } })
      await queryClient.invalidateQueries({ queryKey: getAuthControllerMeQueryKey() })
      onVerified()
    } catch (error) {
      form.setError('root', { message: getApiErrorMessage(error, 'Invalid or expired code.') })
    }
  })

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="grid gap-4">
        {devCode && (
          <p className="rounded-md bg-accent px-3 py-2 text-accent-foreground text-sm">
            Dev mode: code auto-filled ({devCode}).
          </p>
        )}
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Verification code</FormLabel>
              <FormControl>
                <InputOTP
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  disabled={expired}
                  {...field}
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <InputOTPSlot key={index} index={index} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {expired ? (
          <p className="text-destructive text-sm">
            This code has expired. Go back and sign in again.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Code expires in {formatCountdown(secondsLeft)}.
          </p>
        )}
        {form.formState.errors.root && (
          <p className="text-destructive text-sm">{form.formState.errors.root.message}</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button type="submit" disabled={expired || verify.isPending}>
            {verify.isPending && <Spinner />}
            {verify.isPending ? 'Verifying…' : 'Verify'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
