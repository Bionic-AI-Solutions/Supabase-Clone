import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Database, ArrowLeft, ExternalLink } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";

export default function Studio() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const projectId = params.id ? parseInt(params.id) : null;

  const { data: project, isLoading } = trpc.projects.get.useQuery(
    { id: projectId! },
    { enabled: !!projectId && isAuthenticated }
  );

  const { data: credentials } = trpc.projects.credentials.get.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId && isAuthenticated }
  );

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} projectName="" />
        <div className="container py-8">
          <Skeleton className="h-12 w-64 mb-8" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} projectName="" />
        <div className="container py-8">
          <p>Project not found</p>
        </div>
      </div>
    );
  }

  // In a real implementation, this would be the actual Supabase Studio URL
  // For now, we'll show a placeholder that explains the Studio integration
  const studioUrl = `https://supabase.com/dashboard/project/${project.slug}`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} projectName={project.name} projectId={project.id} />
      
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-2xl text-center space-y-6">
          <Database className="w-20 h-20 mx-auto text-primary" />
          <h1 className="text-3xl font-bold">Supabase Studio Integration</h1>
          <div className="space-y-4 text-muted-foreground">
            <p>
              The Supabase Studio provides a complete interface for managing your database schema,
              running SQL queries, configuring authentication, managing storage, and more.
            </p>
            <p>
              In a production deployment, this page would embed the actual Supabase Studio interface
              using an iframe with proper authentication and project context switching.
            </p>
            <div className="bg-muted p-6 rounded-lg text-left space-y-2">
              <p className="font-semibold text-foreground">Studio Features:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Table Editor - Visual database schema builder</li>
                <li>SQL Editor - Run queries and manage migrations</li>
                <li>Authentication - Configure auth providers and policies</li>
                <li>Storage - Manage buckets and files</li>
                <li>Edge Functions - Deploy and manage serverless functions</li>
                <li>Realtime - Configure realtime subscriptions</li>
                <li>API Docs - Auto-generated API documentation</li>
              </ul>
            </div>
            <div className="pt-4">
              <p className="text-sm font-medium text-foreground mb-2">Project Details:</p>
              <div className="bg-muted p-4 rounded text-sm space-y-1 font-mono">
                <div>Project: {project.name}</div>
                <div>Database: {project.databaseName}</div>
                <div>Region: {project.region}</div>
                <div>Status: {project.status}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link href={`/projects/${project.id}`}>
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Project
              </Button>
            </Link>
            <a href={studioUrl} target="_blank" rel="noopener noreferrer">
              <Button>
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Supabase Studio (External)
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Header({ user, projectName, projectId }: { user: any; projectName: string; projectId?: number }) {
  return (
    <div className="border-b border-border">
      <div className="container py-4 flex items-center justify-between">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <Database className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold">Supabase Platform</span>
            {projectName && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="text-lg">{projectName}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-lg text-primary">Studio</span>
              </>
            )}
          </div>
        </Link>
        <div className="flex items-center gap-4">
          {projectId && (
            <Link href={`/projects/${projectId}`}>
              <Button variant="ghost">Project Overview</Button>
            </Link>
          )}
          <Link href="/dashboard"><Button variant="ghost">Dashboard</Button></Link>
          <Link href="/projects"><Button variant="ghost">Projects</Button></Link>
          {user?.role === "admin" && (
            <Link href="/admin"><Button variant="outline">Admin</Button></Link>
          )}
        </div>
      </div>
    </div>
  );
}
