import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Database, Copy, RefreshCw, Trash2, AlertTriangle, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
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

  const regenerateApiKeysMutation = trpc.projects.credentials.regenerateKeys.useMutation({
    onSuccess: () => {
      utils.projects.credentials.get.invalidate();
      toast.success("API keys regenerated");
    },
    onError: (error: any) => {
      toast.error(`Failed to regenerate API keys: ${error.message}`);
    },
  });

  const regenerateJwtSecretMutation = trpc.projects.credentials.regenerateJwt.useMutation({
    onSuccess: () => {
      utils.projects.credentials.get.invalidate();
      toast.success("JWT secret regenerated");
    },
    onError: (error: any) => {
      toast.error(`Failed to regenerate JWT secret: ${error.message}`);
    },
  });

  const deleteMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      toast.success("Project deleted");
      setLocation("/projects");
    },
    onError: (error: any) => {
      toast.error(`Failed to delete project: ${error.message}`);
    },
  });

  const [showRegenerateApiKeysDialog, setShowRegenerateApiKeysDialog] = useState(false);
  const [showRegenerateJwtDialog, setShowRegenerateJwtDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

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

          <TabsContent value="settings" className="space-y-6">
            {/* General Settings */}
            <Card>
              <CardHeader>
                <CardTitle>General</CardTitle>
                <CardDescription>Basic project configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Project Name</Label>
                  <p className="text-sm mt-1">{project.name}</p>
                </div>
                <div>
                  <Label>Project ID</Label>
                  <p className="text-sm font-mono mt-1">{project.id}</p>
                </div>
                <div>
                  <Label>Region</Label>
                  <p className="text-sm mt-1">{project.region}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">
                    <Badge variant={project.status === "active" ? "default" : "secondary"}>
                      {project.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Database Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Database Configuration</CardTitle>
                <CardDescription>Database connection details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Database Name</Label>
                  <p className="text-sm font-mono mt-1">{project.databaseName}</p>
                </div>
                <div>
                  <Label>Database Schema</Label>
                  <p className="text-sm font-mono mt-1">{project.databaseSchema}</p>
                </div>
              </CardContent>
            </Card>

            {/* API Keys Management */}
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Regenerate your project API keys</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Anon & Service Role Keys</p>
                    <p className="text-sm text-muted-foreground">Regenerate both API keys</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowRegenerateApiKeysDialog(true)}
                    disabled={regenerateApiKeysMutation.isPending}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">JWT Secret</p>
                    <p className="text-sm text-muted-foreground">Regenerate JWT signing secret</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowRegenerateJwtDialog(true)}
                    disabled={regenerateJwtSecretMutation.isPending}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                <CardDescription>Irreversible and destructive actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-destructive rounded-lg">
                  <div>
                    <p className="font-medium">Delete Project</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete this project and all its data
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Project
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Regenerate API Keys Dialog */}
        <Dialog open={showRegenerateApiKeysDialog} onOpenChange={setShowRegenerateApiKeysDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Regenerate API Keys</DialogTitle>
              <DialogDescription>
                This will generate new Anon and Service Role keys. Your old keys will stop working immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-500 mb-1">Warning</p>
                <p className="text-muted-foreground">
                  Any applications using the old keys will lose access. Make sure to update all your applications with the new keys.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRegenerateApiKeysDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  regenerateApiKeysMutation.mutate({ projectId: project.id });
                  setShowRegenerateApiKeysDialog(false);
                }}
                disabled={regenerateApiKeysMutation.isPending}
              >
                {regenerateApiKeysMutation.isPending ? "Regenerating..." : "Regenerate Keys"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Regenerate JWT Secret Dialog */}
        <Dialog open={showRegenerateJwtDialog} onOpenChange={setShowRegenerateJwtDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Regenerate JWT Secret</DialogTitle>
              <DialogDescription>
                This will generate a new JWT signing secret. All existing JWTs will become invalid.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-500 mb-1">Warning</p>
                <p className="text-muted-foreground">
                  All users will be logged out and existing tokens will stop working. Update your backend services with the new secret.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRegenerateJwtDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  regenerateJwtSecretMutation.mutate({ projectId: project.id });
                  setShowRegenerateJwtDialog(false);
                }}
                disabled={regenerateJwtSecretMutation.isPending}
              >
                {regenerateJwtSecretMutation.isPending ? "Regenerating..." : "Regenerate Secret"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Project Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Project</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete the project and all its data.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive mb-1">Permanent Deletion</p>
                <p className="text-muted-foreground">
                  All databases, storage, edge functions, and configuration will be permanently deleted.
                </p>
              </div>
            </div>
            <div>
              <Label>Type <span className="font-mono">{project.name}</span> to confirm</Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={project.name}
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText("");
              }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  deleteMutation.mutate({ id: project.id });
                  setShowDeleteDialog(false);
                  setDeleteConfirmText("");
                }}
                disabled={deleteConfirmText !== project.name || deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Project"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
