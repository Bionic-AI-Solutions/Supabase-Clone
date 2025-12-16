import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Database, FolderKanban, Users, Activity, Plus } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);

  const { data: organizations, isLoading: orgsLoading } = trpc.organizations.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: projects, isLoading: projectsLoading } = trpc.projects.list.useQuery(
    { organizationId: selectedOrgId! },
    { enabled: !!selectedOrgId }
  );

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (organizations && organizations.length > 0 && !selectedOrgId) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  if (authLoading || orgsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} />
        <div className="container py-8">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} />
        <div className="flex items-center justify-center" style={{ minHeight: "calc(100vh - 80px)" }}>
          <div className="text-center">
            <FolderKanban className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2 text-foreground">No Organizations Yet</h2>
            <p className="text-muted-foreground mb-6">Create your first organization to get started</p>
            <Link href="/organizations">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Organization
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeProjects = projects?.filter((p) => p.status === "active").length || 0;
  const totalProjects = projects?.length || 0;

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />

      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.name || user?.email || "User"}
          </p>
        </div>

        <div className="mb-8">
          <label className="text-sm font-medium mb-2 block text-foreground">
            Selected Organization
          </label>
          <div className="flex items-center gap-4">
            <select
              className="flex-1 max-w-md px-4 py-2 rounded-md border border-input bg-background text-foreground"
              value={selectedOrgId || ""}
              onChange={(e) => setSelectedOrgId(Number(e.target.value))}
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <Link href="/organizations">
              <Button variant="outline">Manage Organizations</Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Projects"
            value={totalProjects}
            icon={<FolderKanban className="w-8 h-8 text-primary" />}
          />
          <StatCard
            title="Active Projects"
            value={activeProjects}
            icon={<Activity className="w-8 h-8 text-green-500" />}
          />
          <StatCard
            title="Organizations"
            value={organizations.length}
            icon={<Users className="w-8 h-8 text-blue-500" />}
          />
          <StatCard
            title="Team Members"
            value={organizations.reduce((sum, org) => sum + 1, 0)}
            icon={<Users className="w-8 h-8 text-purple-500" />}
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Projects</CardTitle>
                <CardDescription>Your most recently created projects</CardDescription>
              </div>
              <Link href="/projects">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Project
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {projectsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : projects && projects.length > 0 ? (
              <div className="space-y-4">
                {projects.slice(0, 5).map((project) => (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <div className="p-4 rounded-lg border border-border hover:bg-accent cursor-pointer transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{project.name}</h3>
                          <p className="text-sm text-muted-foreground">{project.region}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              project.status === "active"
                                ? "bg-green-500/20 text-green-500"
                                : project.status === "paused"
                                ? "bg-yellow-500/20 text-yellow-500"
                                : "bg-gray-500/20 text-gray-500"
                            }`}
                          >
                            {project.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No projects yet. Create your first project to get started.</p>
                <Link href="/projects">
                  <Button className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Project
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
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
            <span className="text-xl font-bold text-foreground">Supabase Platform</span>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost">Dashboard</Button>
          </Link>
          <Link href="/organizations">
            <Button variant="ghost">Organizations</Button>
          </Link>
          <Link href="/projects">
            <Button variant="ghost">Projects</Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost">Settings</Button>
          </Link>
          {user?.role === "admin" && (
            <Link href="/admin">
              <Button variant="outline">Admin</Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
          </div>
          <div>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
