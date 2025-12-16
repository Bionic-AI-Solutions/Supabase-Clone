import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Database, Copy, Key, Settings as SettingsIcon, Pause, Play } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function ProjectDetail() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams();
  const projectId = params.id ? parseInt(params.id) : null;

  const utils = trpc.useUtils();
  const { data: project, isLoading } = trpc.projects.get.useQuery(
    { id: projectId! },
    { enabled: !!projectId && isAuthenticated }
  );

  const { data: credentials } = trpc.projects.credentials.get.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId && isAuthenticated }
  );

  const pauseMutation = trpc.projects.pause.useMutation({
    onSuccess: () => {
      utils.projects.get.invalidate();
      toast.success("Project paused");
    },
  });

  const resumeMutation = trpc.projects.resume.useMutation({
    onSuccess: () => {
      utils.projects.get.invalidate();
      toast.success("Project resumed");
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} />
        <div className="container py-8">
          <Skeleton className="h-12 w-64 mb-8" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} />
        <div className="container py-8">
          <p>Project not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
            <p className="text-muted-foreground">{project.region}</p>
          </div>
          <div className="flex items-center gap-2">
            {project.status === "active" ? (
              <Button variant="outline" onClick={() => pauseMutation.mutate({ id: project.id })}>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
            ) : (
              <Button variant="outline" onClick={() => resumeMutation.mutate({ id: project.id })}>
                <Play className="w-4 h-4 mr-2" />
                Resume
              </Button>
            )}
            <Link href={`/projects/${project.id}/studio`}>
              <Button>Open Studio</Button>
            </Link>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-medium">{project.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Region</p>
                    <p className="font-medium">{project.region}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Database</p>
                    <p className="font-mono text-sm">{project.databaseName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">{new Date(project.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="credentials" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Use these keys to connect to your project</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Anon Key</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="flex-1 p-3 bg-muted rounded text-sm font-mono break-all">
                      {credentials?.anonKey || "Loading..."}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(credentials?.anonKey || "", "Anon key")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Service Role Key</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="flex-1 p-3 bg-muted rounded text-sm font-mono break-all">
                      {credentials?.serviceKey || "Loading..."}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(credentials?.serviceKey || "", "Service role key")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>JWT Secret</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="flex-1 p-3 bg-muted rounded text-sm font-mono break-all">
                      {credentials?.jwtSecret || "Loading..."}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(credentials?.jwtSecret || "", "JWT secret")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Project Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Settings coming soon</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Header({ user }: { user: any }) {
  return (
    <div className="border-b border-border">
      <div className="container py-4 flex items-center justify-between">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <Database className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold">Supabase Platform</span>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard"><Button variant="ghost">Dashboard</Button></Link>
          <Link href="/organizations"><Button variant="ghost">Organizations</Button></Link>
          <Link href="/projects"><Button variant="ghost">Projects</Button></Link>
          <Link href="/settings"><Button variant="ghost">Settings</Button></Link>
          {user?.role === "admin" && (
            <Link href="/admin"><Button variant="outline">Admin</Button></Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium">{children}</label>;
}
