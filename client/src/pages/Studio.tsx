import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Database, 
  Play, 
  Table as TableIcon, 
  Code, 
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";

export default function Studio() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const projectId = params.id ? parseInt(params.id) : 0;

  const [activeTab, setActiveTab] = useState("sql-editor");

  const { data: project, isLoading } = trpc.projects.get.useQuery(
    { id: projectId },
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

  if (!project) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b">
          <div className="container py-6">
            <h1 className="text-2xl font-bold">Project Not Found</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">{project.name} - Database Studio</h1>
                <p className="text-muted-foreground">
                  Manage your database with SQL editor, table browser, and schema visualizer
                </p>
              </div>
            </div>
            <Link href={`/projects/${projectId}`}>
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Project
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sql-editor" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              SQL Editor
            </TabsTrigger>
            <TabsTrigger value="table-browser" className="flex items-center gap-2">
              <TableIcon className="h-4 w-4" />
              Table Browser
            </TabsTrigger>
            <TabsTrigger value="schema" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Schema
            </TabsTrigger>
            <TabsTrigger value="api-docs" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              API Docs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sql-editor">
            <SQLEditor projectId={projectId} />
          </TabsContent>

          <TabsContent value="table-browser">
            <TableBrowser projectId={projectId} />
          </TabsContent>

          <TabsContent value="schema">
            <SchemaVisualizer projectId={projectId} />
          </TabsContent>

          <TabsContent value="api-docs">
            <APIDocumentation projectId={projectId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============================================================================
// SQL EDITOR COMPONENT
// ============================================================================

function SQLEditor({ projectId }: { projectId: number }) {
  const [query, setQuery] = useState("SELECT * FROM users LIMIT 10;");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const executeQueryMutation = trpc.database.executeQuery.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setError(null);
    },
    onError: (err) => {
      setError(err.message);
      setResult(null);
    },
  });

  const handleExecute = () => {
    if (!query.trim()) {
      setError("Please enter a SQL query");
      return;
    }
    executeQueryMutation.mutate({ projectId, query });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SQL Query Editor</CardTitle>
          <CardDescription>
            Execute SQL queries against your project database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your SQL query..."
              className="font-mono min-h-[200px]"
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Tip: Results are limited to 1000 rows by default
              </p>
              <Button
                onClick={handleExecute}
                disabled={executeQueryMutation.isPending}
                className="gap-2"
              >
                {executeQueryMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Execute Query
                  </>
                )}
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Query executed successfully in {result.executionTime}ms. Returned {result.rowCount} rows.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {result && result.rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Query Results</CardTitle>
            <CardDescription>
              {result.rowCount} rows returned
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {result.columns.map((col: string) => (
                      <TableHead key={col} className="font-mono text-xs">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row: any, idx: number) => (
                    <TableRow key={idx}>
                      {result.columns.map((col: string) => (
                        <TableCell key={col} className="font-mono text-xs">
                          {row[col] === null ? (
                            <span className="text-muted-foreground italic">NULL</span>
                          ) : (
                            String(row[col])
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// TABLE BROWSER COMPONENT
// ============================================================================

function TableBrowser({ projectId }: { projectId: number }) {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: tables, isLoading: tablesLoading } = trpc.database.getTables.useQuery({ projectId });
  
  const { data: tableData, isLoading: dataLoading } = trpc.database.getTableData.useQuery(
    { projectId, tableName: selectedTable!, page, pageSize: 50 },
    { enabled: !!selectedTable }
  );

  const { data: columns } = trpc.database.getTableColumns.useQuery(
    { projectId, tableName: selectedTable! },
    { enabled: !!selectedTable }
  );

  return (
    <div className="grid grid-cols-4 gap-6">
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle>Tables</CardTitle>
          <CardDescription>
            {tables?.length || 0} tables
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tablesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {tables?.map((table) => (
                <Button
                  key={table.tableName}
                  variant={selectedTable === table.tableName ? "default" : "ghost"}
                  className="w-full justify-start font-mono text-sm"
                  onClick={() => {
                    setSelectedTable(table.tableName);
                    setPage(1);
                  }}
                >
                  <TableIcon className="h-4 w-4 mr-2" />
                  {table.tableName}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="col-span-3 space-y-6">
        {selectedTable ? (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-mono">{selectedTable}</CardTitle>
                    <CardDescription>
                      {tableData?.total || 0} rows total
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{columns?.length || 0} columns</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {dataLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : tableData && tableData.data.length > 0 ? (
                  <div className="space-y-4">
                    <div className="border rounded-lg overflow-auto max-h-[600px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {columns?.map((col) => (
                              <TableHead key={col.columnName} className="font-mono text-xs">
                                <div className="flex items-center gap-2">
                                  {col.columnName}
                                  {col.isPrimaryKey && (
                                    <Badge variant="secondary" className="text-[10px] px-1">
                                      PK
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground font-normal">
                                  {col.dataType}
                                </div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tableData.data.map((row: any, idx: number) => (
                            <TableRow key={idx}>
                              {columns?.map((col) => (
                                <TableCell key={col.columnName} className="font-mono text-xs">
                                  {row[col.columnName] === null ? (
                                    <span className="text-muted-foreground italic">NULL</span>
                                  ) : (
                                    String(row[col.columnName])
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, tableData.total)} of {tableData.total} rows
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage(p => p + 1)}
                          disabled={page * 50 >= tableData.total}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No data in this table
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <TableIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a table to view its data</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SCHEMA VISUALIZER COMPONENT
// ============================================================================

function SchemaVisualizer({ projectId }: { projectId: number }) {
  const { data: schema, isLoading } = trpc.database.getSchemaInfo.useQuery({ projectId });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Database Schema</CardTitle>
          <CardDescription>
            {schema?.tables.length || 0} tables, {schema?.relationships.length || 0} relationships
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {schema?.tables.map((table) => (
              <Card key={table.name}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-mono">{table.name}</CardTitle>
                    <Badge variant="outline">{table.rowCount} rows</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {table.columns.map((col) => (
                      <div
                        key={col.columnName}
                        className="flex items-center justify-between text-sm font-mono py-1 px-2 rounded hover:bg-accent"
                      >
                        <div className="flex items-center gap-2">
                          <span className={col.isPrimaryKey ? "font-bold" : ""}>
                            {col.columnName}
                          </span>
                          {col.isPrimaryKey && (
                            <Badge variant="secondary" className="text-[10px] px-1">
                              PK
                            </Badge>
                          )}
                          {col.isForeignKey && (
                            <Badge variant="outline" className="text-[10px] px-1">
                              FK
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {col.dataType}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {schema && schema.relationships.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Relationships</CardTitle>
            <CardDescription>
              Foreign key relationships between tables
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {schema.relationships.map((rel, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 border rounded-lg font-mono text-sm"
                >
                  <Badge variant="outline">{rel.fromTable}</Badge>
                  <span className="text-muted-foreground">{rel.fromColumn}</span>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="outline">{rel.toTable}</Badge>
                  <span className="text-muted-foreground">{rel.toColumn}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// API DOCUMENTATION COMPONENT
// ============================================================================

function APIDocumentation({ projectId }: { projectId: number }) {
  const { data: schema } = trpc.database.getSchemaInfo.useQuery({ projectId });
  const { data: project } = trpc.projects.get.useQuery({ id: projectId });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>REST API Documentation</CardTitle>
          <CardDescription>
            Auto-generated API endpoints based on your database schema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              Your project's REST API is automatically generated from your database schema.
              All endpoints require authentication using your API keys.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {schema?.tables.map((table) => (
        <Card key={table.name}>
          <CardHeader>
            <CardTitle className="font-mono text-lg">/{table.name}</CardTitle>
            <CardDescription>
              CRUD operations for {table.name} table
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Badge className="bg-green-500">GET</Badge>
                  <code className="text-sm">/{table.name}</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  List all {table.name} with optional filtering and pagination
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Badge className="bg-blue-500">POST</Badge>
                  <code className="text-sm">/{table.name}</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Create a new {table.name.slice(0, -1)} record
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Badge className="bg-yellow-500">PATCH</Badge>
                  <code className="text-sm">/{table.name}/&#123;id&#125;</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Update an existing {table.name.slice(0, -1)} record
                </p>
              </div>

              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Badge className="bg-red-500">DELETE</Badge>
                  <code className="text-sm">/{table.name}/&#123;id&#125;</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Delete a {table.name.slice(0, -1)} record
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
