import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  Users, 
  FolderKanban,
  ArrowLeft,
  UserPlus,
  Settings,
} from "lucide-react";
import { format } from "date-fns";

export default function OrganizationDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const organizationId = params.id ? parseInt(params.id) : 0;

  const { data: organization, isLoading: orgLoading } = trpc.organizations.get.useQuery(
    { id: organizationId },
    { enabled: !!organizationId && isAuthenticated }
  );

  const { data: members, isLoading: membersLoading } = trpc.organizations.members.list.useQuery(
    { organizationId },
    { enabled: !!organizationId && isAuthenticated }
  );

  const { data: projects, isLoading: projectsLoading } = trpc.projects.list.useQuery(
    { organizationId },
    { enabled: !!organizationId && isAuthenticated }
  );

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || orgLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b">
          <div className="container py-6">
            <Skeleton className="h-10 w-64" />
          </div>
        </div>
        <div className="container py-8">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b">
          <div className="container py-6">
            <h1 className="text-2xl font-bold">Organization Not Found</h1>
          </div>
        </div>
      </div>
    );
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default";
      case "admin":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "paused":
        return "secondary";
      case "provisioning":
        return "outline";
      default:
        return "destructive";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">{organization.name}</h1>
                <p className="text-muted-foreground">
                  Organization details and management
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/organizations/${organizationId}/team`}>
                <Button variant="outline" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Manage Team
                </Button>
              </Link>
              <Link href="/organizations">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Organizations
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-6">
        {/* Organization Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Organization Information
            </CardTitle>
            <CardDescription>
              Basic information about this organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Name</p>
                <p className="text-lg">{organization.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Slug</p>
                <p className="text-lg font-mono">{organization.slug}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Database</p>
                <p className="text-lg font-mono">{organization.orgDatabase}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <p className="text-lg">{format(new Date(organization.createdAt), "MMM d, yyyy")}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Team Members Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
            </CardTitle>
            <CardDescription>
              {members?.length || 0} members in this organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading members...</div>
            ) : members && members.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.userName || "Unknown"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {member.userEmail || "No email"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(member.role)}>
                            {member.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(member.joinedAt), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No team members yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Projects Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5" />
              Projects
            </CardTitle>
            <CardDescription>
              {projects?.length || 0} projects in this organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projectsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading projects...</div>
            ) : projects && projects.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">{project.name}</TableCell>
                        <TableCell className="text-muted-foreground">{project.region}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(project.status)}>
                            {project.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(project.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/projects/${project.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No projects yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
