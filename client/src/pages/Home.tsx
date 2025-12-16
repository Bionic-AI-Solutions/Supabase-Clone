import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Database, Zap, Shield, Globe, Code, Activity } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold text-foreground">Supabase Platform</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost">Dashboard</Button>
                </Link>
                <Link href="/organizations">
                  <Button>Go to Projects</Button>
                </Link>
              </>
            ) : (
              <>
                <a href={getLoginUrl()}>
                  <Button variant="ghost">Sign In</Button>
                </a>
                <a href={getLoginUrl()}>
                  <Button>Get Started</Button>
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-background to-secondary/20">
        <div className="container text-center">
          <h1 className="text-5xl font-bold mb-6 text-foreground">
            Multi-Tenant Supabase Platform
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Build and manage multiple isolated Supabase projects with full backend capabilities.
            Authentication, database, storage, realtime, and edge functions - all in one platform.
          </p>
          <div className="flex gap-4 justify-center">
            {isAuthenticated ? (
              <Link href="/organizations">
                <Button size="lg" className="text-lg px-8">
                  View Your Projects
                </Button>
              </Link>
            ) : (
              <a href={getLoginUrl()}>
                <Button size="lg" className="text-lg px-8">
                  Start Building
                </Button>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
            Everything You Need for Modern Applications
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Database className="w-10 h-10 text-primary" />}
              title="Isolated Databases"
              description="Each project gets its own PostgreSQL database with full isolation and security."
            />
            <FeatureCard
              icon={<Shield className="w-10 h-10 text-primary" />}
              title="Authentication"
              description="Built-in authentication with JWT tokens and row-level security policies."
            />
            <FeatureCard
              icon={<Globe className="w-10 h-10 text-primary" />}
              title="Object Storage"
              description="S3-compatible storage with per-project buckets and access policies."
            />
            <FeatureCard
              icon={<Zap className="w-10 h-10 text-primary" />}
              title="Realtime"
              description="WebSocket connections for realtime data sync, presence, and broadcasts."
            />
            <FeatureCard
              icon={<Code className="w-10 h-10 text-primary" />}
              title="Edge Functions"
              description="Deploy serverless Deno functions with environment variables and logs."
            />
            <FeatureCard
              icon={<Activity className="w-10 h-10 text-primary" />}
              title="Usage Analytics"
              description="Track database size, API calls, storage, and bandwidth with detailed metrics."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-secondary/20">
        <div className="container">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
            Flexible Pricing Plans
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <PricingCard
              name="Free"
              price="$0"
              features={[
                "2 projects",
                "500 MB database",
                "1 GB storage",
                "50K API calls/month",
                "10 edge functions",
              ]}
            />
            <PricingCard
              name="Pro"
              price="$25"
              popular
              features={[
                "10 projects",
                "8 GB database",
                "100 GB storage",
                "5M API calls/month",
                "100 edge functions",
                "Custom domains",
                "Priority support",
              ]}
            />
            <PricingCard
              name="Enterprise"
              price="Custom"
              features={[
                "100+ projects",
                "100 GB database",
                "1 TB storage",
                "100M API calls/month",
                "1000 edge functions",
                "Custom domains",
                "Dedicated support",
              ]}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-auto">
        <div className="container text-center text-muted-foreground">
          <p>Multi-Tenant Supabase Platform - Built for developers, by developers</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-lg border border-border bg-card hover:shadow-lg transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2 text-card-foreground">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function PricingCard({ name, price, features, popular }: { name: string; price: string; features: string[]; popular?: boolean }) {
  return (
    <div className={`p-8 rounded-lg border ${popular ? 'border-primary shadow-lg' : 'border-border'} bg-card relative`}>
      {popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
          Popular
        </div>
      )}
      <h3 className="text-2xl font-bold mb-2 text-card-foreground">{name}</h3>
      <div className="mb-6">
        <span className="text-4xl font-bold text-card-foreground">{price}</span>
        {price !== "Custom" && <span className="text-muted-foreground">/month</span>}
      </div>
      <ul className="space-y-3 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-muted-foreground">
            <span className="text-primary mt-1">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Button className="w-full" variant={popular ? "default" : "outline"}>
        Get Started
      </Button>
    </div>
  );
}
