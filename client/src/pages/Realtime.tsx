import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Activity, Radio, Users, Database, Plus, Trash2, Settings, Eye } from "lucide-react";

type ChannelType = "broadcast" | "presence" | "postgres_changes";

export default function Realtime() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id);

  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState<ChannelType>("broadcast");
  const [newChannelSchema, setNewChannelSchema] = useState("");
  const [newChannelTable, setNewChannelTable] = useState("");
  const [newChannelFilter, setNewChannelFilter] = useState("");

  const utils = trpc.useUtils();
  const { data: project } = trpc.projects.get.useQuery({ id: projectId });
  const { data: channels } = trpc.realtime.channels.list.useQuery({ projectId });
  const { data: selectedChannelData } = trpc.realtime.channels.getById.useQuery(
    { id: selectedChannel! },
    { enabled: !!selectedChannel }
  );

  const createChannel = trpc.realtime.channels.create.useMutation({
    onSuccess: () => {
      toast.success("Channel created successfully");
      utils.realtime.channels.list.invalidate({ projectId });
      setIsCreateDialogOpen(false);
      setNewChannelName("");
      setNewChannelType("broadcast");
      setNewChannelSchema("");
      setNewChannelTable("");
      setNewChannelFilter("");
    },
    onError: (error) => {
      toast.error(`Failed to create channel: ${error.message}`);
    },
  });

  const updateChannel = trpc.realtime.channels.update.useMutation({
    onSuccess: () => {
      toast.success("Channel updated successfully");
      utils.realtime.channels.list.invalidate({ projectId });
      utils.realtime.channels.getById.invalidate({ id: selectedChannel! });
    },
    onError: (error) => {
      toast.error(`Failed to update channel: ${error.message}`);
    },
  });

  const deleteChannel = trpc.realtime.channels.delete.useMutation({
    onSuccess: () => {
      toast.success("Channel deleted successfully");
      utils.realtime.channels.list.invalidate({ projectId });
      setSelectedChannel(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete channel: ${error.message}`);
    },
  });

  const handleCreateChannel = () => {
    if (!newChannelName.trim()) {
      toast.error("Channel name is required");
      return;
    }

    createChannel.mutate({
      projectId,
      name: newChannelName,
      type: newChannelType,
      schema: newChannelSchema || undefined,
      table: newChannelTable || undefined,
      filter: newChannelFilter || undefined,
    });
  };

  const handleToggleChannel = (channelId: number, enabled: boolean) => {
    updateChannel.mutate({ id: channelId, enabled });
  };

  const handleDeleteChannel = (channelId: number) => {
    if (confirm("Are you sure you want to delete this channel?")) {
      deleteChannel.mutate({ id: channelId });
    }
  };

  const getChannelIcon = (type: ChannelType) => {
    switch (type) {
      case "broadcast":
        return <Radio className="h-4 w-4" />;
      case "presence":
        return <Users className="h-4 w-4" />;
      case "postgres_changes":
        return <Database className="h-4 w-4" />;
    }
  };

  const getChannelTypeColor = (type: ChannelType) => {
    switch (type) {
      case "broadcast":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "presence":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "postgres_changes":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Realtime Channels</h1>
        <p className="text-muted-foreground">
          Manage realtime channels for {project?.name}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel List Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Channels</CardTitle>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      New
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Realtime Channel</DialogTitle>
                      <DialogDescription>
                        Configure a new realtime channel for your project
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="channel-name">Channel Name</Label>
                        <Input
                          id="channel-name"
                          placeholder="e.g., public:messages"
                          value={newChannelName}
                          onChange={(e) => setNewChannelName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="channel-type">Channel Type</Label>
                        <Select value={newChannelType} onValueChange={(value) => setNewChannelType(value as ChannelType)}>
                          <SelectTrigger id="channel-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="broadcast">Broadcast</SelectItem>
                            <SelectItem value="presence">Presence</SelectItem>
                            <SelectItem value="postgres_changes">Postgres Changes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {newChannelType === "postgres_changes" && (
                        <>
                          <div>
                            <Label htmlFor="channel-schema">Schema</Label>
                            <Input
                              id="channel-schema"
                              placeholder="public"
                              value={newChannelSchema}
                              onChange={(e) => setNewChannelSchema(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="channel-table">Table</Label>
                            <Input
                              id="channel-table"
                              placeholder="messages"
                              value={newChannelTable}
                              onChange={(e) => setNewChannelTable(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="channel-filter">Filter (optional)</Label>
                            <Input
                              id="channel-filter"
                              placeholder="user_id=eq.123"
                              value={newChannelFilter}
                              onChange={(e) => setNewChannelFilter(e.target.value)}
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateChannel} disabled={createChannel.isPending}>
                        {createChannel.isPending ? "Creating..." : "Create Channel"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!channels || channels.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No channels yet. Create your first channel to get started.
                </div>
              ) : (
                <div className="divide-y">
                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => setSelectedChannel(channel.id)}
                      className={`w-full p-4 text-left hover:bg-accent transition-colors ${
                        selectedChannel === channel.id ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getChannelIcon(channel.type as ChannelType)}
                            <span className="font-medium truncate">{channel.name}</span>
                          </div>
                          <Badge variant="outline" className={`text-xs ${getChannelTypeColor(channel.type as ChannelType)}`}>
                            {channel.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {channel.enabled ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-500/20">
                              Disabled
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Channel Details */}
        <div className="lg:col-span-2">
          {!selectedChannel ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No channel selected</p>
                <p className="text-sm text-muted-foreground">
                  Select a channel from the list or create a new one
                </p>
              </CardContent>
            </Card>
          ) : selectedChannelData ? (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="inspector">Inspector</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{selectedChannelData.name}</CardTitle>
                        <CardDescription>Channel configuration and status</CardDescription>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteChannel(selectedChannel)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Type</Label>
                        <div className="flex items-center gap-2 mt-1">
                          {getChannelIcon(selectedChannelData.type as ChannelType)}
                          <span className="font-medium capitalize">{selectedChannelData.type.replace("_", " ")}</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Status</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Switch
                            checked={selectedChannelData.enabled}
                            onCheckedChange={(checked) => handleToggleChannel(selectedChannel, checked)}
                          />
                          <span className="text-sm">
                            {selectedChannelData.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {selectedChannelData.type === "postgres_changes" && (
                      <div className="space-y-3">
                        <h3 className="font-medium">Database Configuration</h3>
                        <div className="grid gap-3">
                          <div>
                            <Label className="text-muted-foreground">Schema</Label>
                            <p className="text-sm font-mono mt-1">{selectedChannelData.schema || "N/A"}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Table</Label>
                            <p className="text-sm font-mono mt-1">{selectedChannelData.table || "N/A"}</p>
                          </div>
                          {selectedChannelData.filter && (
                            <div>
                              <Label className="text-muted-foreground">Filter</Label>
                              <p className="text-sm font-mono mt-1">{selectedChannelData.filter}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedChannelData.type === "broadcast" && (
                      <div className="space-y-3">
                        <h3 className="font-medium">Broadcast Channel</h3>
                        <p className="text-sm text-muted-foreground">
                          Broadcast channels allow you to send messages to all connected clients. Perfect for notifications, announcements, and real-time updates.
                        </p>
                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-xs font-mono">
                            const channel = supabase.channel('{selectedChannelData.name}')<br />
                            channel.on('broadcast', {'{'} event: 'message' {'}'}, (payload) =&gt; {'{'}<br />
                            &nbsp;&nbsp;console.log(payload)<br />
                            {'}'})
                          </p>
                        </div>
                      </div>
                    )}

                    {selectedChannelData.type === "presence" && (
                      <div className="space-y-3">
                        <h3 className="font-medium">Presence Tracking</h3>
                        <p className="text-sm text-muted-foreground">
                          Presence channels track which users are currently online and their status. Ideal for collaborative features, chat applications, and activity indicators.
                        </p>
                        <div className="bg-muted p-4 rounded-lg">
                          <p className="text-xs font-mono">
                            const channel = supabase.channel('{selectedChannelData.name}')<br />
                            channel.on('presence', {'{'} event: 'sync' {'}'}, () =&gt; {'{'}<br />
                            &nbsp;&nbsp;const state = channel.presenceState()<br />
                            &nbsp;&nbsp;console.log('Online users:', state)<br />
                            {'}'})
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="inspector" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Realtime Inspector</CardTitle>
                    <CardDescription>Monitor live events and messages</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg p-6 bg-muted/50">
                      <div className="flex items-center justify-center flex-col gap-3">
                        <Eye className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground text-center">
                          Realtime inspector coming soon
                        </p>
                        <p className="text-xs text-muted-foreground text-center max-w-md">
                          This feature will show live events, connection status, and message history for debugging and monitoring your realtime channels.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Channel Settings</CardTitle>
                    <CardDescription>Advanced configuration options</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="channel-config">Configuration (JSON)</Label>
                      <Textarea
                        id="channel-config"
                        placeholder='{"key": "value"}'
                        value={JSON.stringify(selectedChannelData.config || {}, null, 2)}
                        className="font-mono text-sm min-h-[200px]"
                        readOnly
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Advanced configuration options for this channel
                      </p>
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <Label>Enable Channel</Label>
                        <p className="text-sm text-muted-foreground">
                          Allow clients to subscribe to this channel
                        </p>
                      </div>
                      <Switch
                        checked={selectedChannelData.enabled}
                        onCheckedChange={(checked) => handleToggleChannel(selectedChannel, checked)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <p className="text-muted-foreground">Loading channel details...</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
