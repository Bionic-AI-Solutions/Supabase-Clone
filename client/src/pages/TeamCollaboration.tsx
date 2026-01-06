import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  UserPlus, 
  Mail,
  Shield,
  Trash2,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function TeamCollaboration() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const organizationId = params.id ? parseInt(params.id) : 0;

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [removeMemberId, setRemoveMemberId] = useState<number | null>(null);

  const { data: organization, isLoading: orgLoading } = trpc.organizations.get.useQuery(
    { id: organizationId },
    { enabled: !!organizationId && isAuthenticated }
  );

  const { data: members, isLoading: membersLoading, refetch: refetchMembers } = trpc.organizations.members.list.useQuery(
    { organizationId },
    { enabled: !!organizationId && isAuthenticated }
  );

  const addMemberMutation = trpc.organizations.members.add.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message);
        setInviteEmail("");
        setInviteRole("member");
        refetchMembers();
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateRoleMutation = trpc.organizations.members.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Member role updated successfully");
      refetchMembers();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const removeMemberMutation = trpc.organizations.members.remove.useMutation({
    onSuccess: () => {
      toast.success("Member removed successfully");
      setRemoveMemberId(null);
      refetchMembers();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

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

  const handleInviteMember = () => {
    if (!inviteEmail) {
      toast.error("Please enter an email address");
      return;
    }

    addMemberMutation.mutate({
      organizationId,
      userEmail: inviteEmail,
      role: inviteRole,
    });
  };

  const handleUpdateRole = (memberId: number, newRole: "owner" | "admin" | "member") => {
    updateRoleMutation.mutate({
      memberId,
      role: newRole,
    });
  };

  const handleRemoveMember = () => {
    if (removeMemberId) {
      removeMemberMutation.mutate({ memberId: removeMemberId });
    }
  };

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

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">{organization.name} - Team</h1>
                <p className="text-muted-foreground">
                  Manage team members and their roles
                </p>
              </div>
            </div>
            <Link href={`/organizations/${organizationId}`}>
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Organization
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container py-8 space-y-6">
        {/* Invite Member Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Team Member
            </CardTitle>
            <CardDescription>
              Add new members to your organization by email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <Label htmlFor="email">Email Address</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="member@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={inviteRole} onValueChange={(value: "admin" | "member") => setInviteRole(value)}>
                  <SelectTrigger id="role" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={handleInviteMember} 
                  disabled={addMemberMutation.isPending}
                  className="w-full"
                >
                  {addMemberMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Inviting...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite Member
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Note:</strong> Users must sign up first before they can be added to the organization.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Members List Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Team Members
            </CardTitle>
            <CardDescription>
              {members?.length || 0} members in this organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : members && members.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
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
                          {new Date(member.joinedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {member.role !== "owner" && (
                              <>
                                <Select
                                  value={member.role}
                                  onValueChange={(value: "owner" | "admin" | "member") => 
                                    handleUpdateRole(member.id, value)
                                  }
                                  disabled={updateRoleMutation.isPending}
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="member">Member</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="owner">Owner</SelectItem>
                                  </SelectContent>
                                </Select>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setRemoveMemberId(member.id)}
                                  disabled={removeMemberMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No team members yet. Invite your first member above.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Role Descriptions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Role Permissions</CardTitle>
            <CardDescription>
              Understanding team member roles and their permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Badge variant="default">Owner</Badge>
                <div className="flex-1">
                  <p className="font-medium">Full access</p>
                  <p className="text-sm text-muted-foreground">
                    Can manage all aspects of the organization, including billing, members, and projects. Can transfer ownership.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge variant="secondary">Admin</Badge>
                <div className="flex-1">
                  <p className="font-medium">Administrative access</p>
                  <p className="text-sm text-muted-foreground">
                    Can manage projects, invite members, and configure settings. Cannot access billing or remove owners.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Badge variant="outline">Member</Badge>
                <div className="flex-1">
                  <p className="font-medium">Standard access</p>
                  <p className="text-sm text-muted-foreground">
                    Can view and work with projects. Cannot invite members or change organization settings.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Remove Member Confirmation Dialog */}
      <Dialog open={!!removeMemberId} onOpenChange={(open) => !open && setRemoveMemberId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this member from the organization? They will lose access to all projects.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveMemberId(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleRemoveMember}
              disabled={removeMemberMutation.isPending}
            >
              {removeMemberMutation.isPending ? "Removing..." : "Remove Member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
