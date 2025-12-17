import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Play, Trash2, Plus, Code, Settings, Terminal, Save, Upload } from "lucide-react";
import Editor from "@monaco-editor/react";

export default function EdgeFunctions() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const projectId = parseInt(id || "0");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedFunction, setSelectedFunction] = useState<number | null>(null);
  const [functionCode, setFunctionCode] = useState("");
  const [functionName, setFunctionName] = useState("");
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [envKey, setEnvKey] = useState("");
  const [envValue, setEnvValue] = useState("");
  const [testPayload, setTestPayload] = useState("{}");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const utils = trpc.useUtils();
  const { data: project } = trpc.projects.get.useQuery({ id: projectId });
  const { data: functions } = trpc.edgeFunctions.list.useQuery({ projectId });
  const { data: selectedFunctionData } = trpc.edgeFunctions.getById.useQuery(
    { id: selectedFunction! },
    { enabled: !!selectedFunction }
  );

  const createFunction = trpc.edgeFunctions.create.useMutation({
    onSuccess: () => {
      toast.success("Edge function created successfully");
      setIsCreateOpen(false);
      setFunctionName("");
      setFunctionCode("");
      utils.edgeFunctions.list.invalidate({ projectId });
    },
    onError: (error) => {
      toast.error(`Failed to create function: ${error.message}`);
    },
  });

  const updateFunction = trpc.edgeFunctions.update.useMutation({
    onSuccess: () => {
      toast.success("Function saved successfully");
      setHasUnsavedChanges(false);
      utils.edgeFunctions.list.invalidate({ projectId });
      utils.edgeFunctions.getById.invalidate({ id: selectedFunction! });
    },
    onError: (error) => {
      toast.error(`Failed to save function: ${error.message}`);
    },
  });

  const deleteFunction = trpc.edgeFunctions.delete.useMutation({
    onSuccess: () => {
      toast.success("Function deleted successfully");
      setSelectedFunction(null);
      utils.edgeFunctions.list.invalidate({ projectId });
    },
    onError: (error) => {
      toast.error(`Failed to delete function: ${error.message}`);
    },
  });

  const deployFunction = trpc.edgeFunctions.deploy.useMutation({
    onSuccess: (data) => {
      toast.success(`Function deployed successfully (v${data.version})`);
      utils.edgeFunctions.list.invalidate({ projectId });
      utils.edgeFunctions.getById.invalidate({ id: selectedFunction! });
    },
    onError: (error) => {
      toast.error(`Failed to deploy function: ${error.message}`);
    },
  });

  const invokeFunction = trpc.edgeFunctions.invoke.useMutation({
    onSuccess: (data) => {
      toast.success("Function invoked successfully");
    },
    onError: (error) => {
      toast.error(`Failed to invoke function: ${error.message}`);
    },
  });

  // Load selected function data when it changes
  useEffect(() => {
    if (selectedFunctionData) {
      setFunctionCode(selectedFunctionData.code || "");
      setEnvVars((selectedFunctionData.envVars as Record<string, string>) || {});
      setHasUnsavedChanges(false);
    }
  }, [selectedFunctionData]);

  const handleCreateFunction = () => {
    if (!functionName.trim()) {
      toast.error("Function name is required");
      return;
    }

    createFunction.mutate({
      projectId,
      name: functionName,
      code: functionCode || undefined,
      envVars: {},
    });
  };

  const handleSaveFunction = () => {
    if (!selectedFunction) return;

    updateFunction.mutate({
      id: selectedFunction,
      code: functionCode,
      envVars,
    });
  };

  const handleDeployFunction = () => {
    if (!selectedFunction) return;

    // Save first if there are unsaved changes, then deploy
    if (hasUnsavedChanges) {
      updateFunction.mutate(
        {
          id: selectedFunction,
          code: functionCode,
          envVars,
        },
        {
          onSuccess: () => {
            deployFunction.mutate({ id: selectedFunction });
          },
        }
      );
    } else {
      deployFunction.mutate({ id: selectedFunction });
    }
  };

  const handleInvokeFunction = () => {
    if (!selectedFunction) return;

    try {
      const payload = JSON.parse(testPayload);
      invokeFunction.mutate({ id: selectedFunction, payload });
    } catch (error) {
      toast.error("Invalid JSON payload");
    }
  };

  const handleAddEnvVar = () => {
    if (!envKey.trim() || !envValue.trim()) {
      toast.error("Both key and value are required");
      return;
    }

    setEnvVars({ ...envVars, [envKey]: envValue });
    setEnvKey("");
    setEnvValue("");
    setHasUnsavedChanges(true);
  };

  const handleRemoveEnvVar = (key: string) => {
    const newEnvVars = { ...envVars };
    delete newEnvVars[key];
    setEnvVars(newEnvVars);
    setHasUnsavedChanges(true);
  };

  const handleCodeChange = (value: string | undefined) => {
    setFunctionCode(value || "");
    setHasUnsavedChanges(true);
  };

  const handleSelectFunction = (funcId: number) => {
    if (hasUnsavedChanges) {
      if (confirm("You have unsaved changes. Discard them?")) {
        setSelectedFunction(funcId);
        setHasUnsavedChanges(false);
      }
    } else {
      setSelectedFunction(funcId);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${projectId}`)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{project?.name} - Edge Functions</h1>
                <p className="text-sm text-muted-foreground">Deploy and manage serverless functions</p>
              </div>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Function
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Edge Function</DialogTitle>
                  <DialogDescription>
                    Create a new serverless function for your project
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="function-name">Function Name</Label>
                    <Input
                      id="function-name"
                      placeholder="my-function"
                      value={functionName}
                      onChange={(e) => setFunctionName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateFunction} disabled={createFunction.isPending}>
                    {createFunction.isPending ? "Creating..." : "Create Function"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="container mx-auto py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Functions List */}
          <div className="col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>Functions</CardTitle>
                <CardDescription>
                  {functions?.length || 0} function{functions?.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {functions && functions.length > 0 ? (
                  <div className="space-y-2">
                    {functions.map((func) => (
                      <div
                        key={func.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedFunction === func.id
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-accent"
                        }`}
                        onClick={() => handleSelectFunction(func.id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Code className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-foreground">{func.name}</span>
                          </div>
                          <Badge variant={func.status === "active" ? "default" : "secondary"}>
                            {func.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          v{func.version} • {new Date(func.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">No functions yet</p>
                    <p className="text-xs">Create your first edge function</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Function Editor */}
          <div className="col-span-9">
            {selectedFunction ? (
              <Tabs defaultValue="code" className="space-y-4">
                <div className="flex items-center justify-between">
                  <TabsList>
                    <TabsTrigger value="code">
                      <Code className="h-4 w-4 mr-2" />
                      Code
                    </TabsTrigger>
                    <TabsTrigger value="settings">
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </TabsTrigger>
                    <TabsTrigger value="test">
                      <Play className="h-4 w-4 mr-2" />
                      Test
                    </TabsTrigger>
                    <TabsTrigger value="logs">
                      <Terminal className="h-4 w-4 mr-2" />
                      Logs
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex gap-2">
                    {hasUnsavedChanges && (
                      <Badge variant="outline" className="text-amber-600">
                        Unsaved changes
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveFunction}
                      disabled={!hasUnsavedChanges || updateFunction.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {updateFunction.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleDeployFunction}
                      disabled={deployFunction.isPending || updateFunction.isPending}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {deployFunction.isPending ? "Deploying..." : "Deploy"}
                    </Button>
                  </div>
                </div>

                <TabsContent value="code" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Function Code</CardTitle>
                      <CardDescription>
                        Edit your TypeScript/JavaScript function code
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="border rounded-lg overflow-hidden">
                        <Editor
                          height="600px"
                          defaultLanguage="typescript"
                          theme="vs-dark"
                          value={functionCode}
                          onChange={handleCodeChange}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: "on",
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            tabSize: 2,
                            wordWrap: "on",
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Environment Variables</CardTitle>
                      <CardDescription>
                        Configure environment variables for your function
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input
                            placeholder="KEY"
                            value={envKey}
                            onChange={(e) => setEnvKey(e.target.value)}
                          />
                        </div>
                        <div className="flex-1">
                          <Input
                            placeholder="value"
                            value={envValue}
                            onChange={(e) => setEnvValue(e.target.value)}
                          />
                        </div>
                        <Button onClick={handleAddEnvVar}>Add</Button>
                      </div>

                      {Object.keys(envVars).length > 0 && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Key</TableHead>
                              <TableHead>Value</TableHead>
                              <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(envVars).map(([key, value]) => (
                              <TableRow key={key}>
                                <TableCell className="font-mono text-foreground">{key}</TableCell>
                                <TableCell className="font-mono text-muted-foreground">{"•".repeat(Math.min(value.length, 20))}</TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveEnvVar(key)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Danger Zone</CardTitle>
                      <CardDescription>
                        Irreversible actions for this function
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete "${selectedFunctionData?.name}"? This action cannot be undone.`)) {
                            deleteFunction.mutate({ id: selectedFunction });
                          }
                        }}
                        disabled={deleteFunction.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {deleteFunction.isPending ? "Deleting..." : "Delete Function"}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="test" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Test Function</CardTitle>
                      <CardDescription>
                        Invoke your function with a test payload
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Request Payload (JSON)</Label>
                        <Textarea
                          className="font-mono mt-2 bg-muted"
                          rows={10}
                          value={testPayload}
                          onChange={(e) => setTestPayload(e.target.value)}
                          placeholder='{\n  "key": "value"\n}'
                        />
                      </div>
                      <Button onClick={handleInvokeFunction} disabled={invokeFunction.isPending}>
                        <Play className="h-4 w-4 mr-2" />
                        {invokeFunction.isPending ? "Invoking..." : "Invoke Function"}
                      </Button>

                      {invokeFunction.data && (
                        <div className="mt-4">
                          <Label>Response</Label>
                          <pre className="mt-2 p-4 bg-muted rounded-lg overflow-auto text-sm font-mono text-foreground">
                            {JSON.stringify(invokeFunction.data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="logs" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Function Logs</CardTitle>
                      <CardDescription>
                        View real-time logs from your function executions
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-[500px] overflow-auto">
                        <div className="space-y-1">
                          <div className="text-muted-foreground"># Function: {selectedFunctionData?.name}</div>
                          <div className="text-muted-foreground"># Status: {selectedFunctionData?.status}</div>
                          <div className="text-muted-foreground"># Version: {selectedFunctionData?.version}</div>
                          <div className="mt-4">[{new Date().toISOString()}] Function ready</div>
                          <div className="text-gray-500">Waiting for invocations...</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            ) : (
              <Card className="h-full">
                <CardContent className="flex items-center justify-center py-32">
                  <div className="text-center text-muted-foreground">
                    <Code className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium text-foreground">Select a function to edit</p>
                    <p className="text-sm">Or create a new function to get started</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
