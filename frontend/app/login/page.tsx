import LoginForm from "@/components/auth/LoginForm"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo / Brand */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl font-bold text-gold-gradient">
            Booth Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">
            Générateur de visuels de marque — Booth Photo Paris
          </p>
        </div>

        <LoginForm />

        <p className="text-center text-xs text-muted-foreground">
          Accès réservé à l&apos;équipe Booth Photo Paris
        </p>
      </div>
    </div>
  )
}
