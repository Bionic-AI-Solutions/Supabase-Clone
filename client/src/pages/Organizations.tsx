import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Database, Plus, Settings, Trash2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function Organizations() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [orgName, setOrgName] = useState("");

  const utils = trpc.useUtils();
  const { data: organizations, isLoading: orgsLoading } = trpc.organizations.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const createMutation = trpc.organizations.create.useMutation({
    onSuccess: () => {
      utils.organizations.list.invalidate();
      setCreateDialogOpen(false);
      setOrgName("");
      toast.success("Organization created successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create organization");
    },
  });

  const updateMutation = trpc.organizations.update.useMutation({
    onSuccess: () => {
      utils.organizations.list.invalidate();
      setEditDialogOpen(false);
      setSelectedOrg(null);
      setOrgName("");
      toast.success("Organization updated successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update organization");
    },
  });

  const deleteMutation = trpc.organizations.delete.useMutation({
    onSuccess: () => {
      utils.organizations.list.invalidate();
      setDeleteDialogOpen(false);
      setSelectedOrg(null);
      toast.success("Organization deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete organization");
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  const handleCreate = () => {
    if (!orgName.trim()) {
      toast.error("Organization name is required");
      return;
    }
    createMutation.mutate({ name: orgName });
  };

  const handleUpdate = () => {
    if (!orgName.trim() || !selectedOrg) {
      toast.error("Organization name is required");
      return;
    }
    updateMutation.mutate({ id: selectedOrg.id, name: orgName });
  };

  const handleDelete = () => {
    if (!selectedOrg) return;
    deleteMutation.mutate({ id: selectedOrg.id });
  };

  const openEditDialog = (org: any) => {
    setSelectedOrg(org);
    setOrgName(org.name);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (org: any) => {
    setSelectedOrg(org);
    setDeleteDialogOpen(true);
  };

  if (authLoading || orgsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} />
        <div className="container py-8">
          <Skeleton className="h-12 w-64 mb-8" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
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
            <h1 className="text-3xl font-bold mb-2 text-foreground">Organizations</h1>
            <p className="text-muted-foreground">Manage your organizations and teams</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Organization
          </Button>
        </div>

        {!organizations || organizations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2 text-foreground">No organizations yet</h3>
              <p className="text-muted-foreground mb-6">Create your first organization to get started</p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Organization
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organizations.map((org) => (
              <Card key={org.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{org.name}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(org)}
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(org)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>Created {new Date(org.createdAt).toLocaleDateString()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Slug</span>
                      <span className="font-mono text-foreground">{org.slug}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Owner</span>
                      <span className="text-foreground">{user?.name || "You"}</span>
                    </div>
                  </div>
                  <Link href={`/projects?org=${org.id}`}>
                    <Button className="w-full mt-4" variant="outline">
                      View Projects
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Create a new organization to manage projects and team members.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="My Organization"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update your organization name and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-name">Organization Name</Label>
              <Input
                id="edit-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="My Organization"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedOrg?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedOrg && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  ⚠️ Important: All projects in this organization must be deleted first.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Please go to the Projects page and delete all projects associated with this organization before attempting to delete it.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
