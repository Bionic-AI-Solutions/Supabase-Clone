import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Calendar, TrendingUp, Database, Zap, HardDrive } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useParams } from 'wouter';

type TimeRange = '24h' | '7d' | '30d' | '90d';

interface AnalyticsData {
  timestamp: string;
  apiCalls: number;
  databaseSize: number;
  storageUsed: number;
  bandwidth: number;
  activeUsers: number;
}

interface SummaryStats {
  totalApiCalls: number;
  totalDatabaseSize: number;
  totalStorageUsed: number;
  totalBandwidth: number;
  totalActiveUsers: number;
  avgResponseTime: number;
  errorRate: number;
}

export default function UsageAnalytics() {
  const { projectId } = useParams<{ projectId: string }>();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const projectIdStr = projectId || '';

  // Generate mock analytics data based on time range
  const analyticsData = useMemo(() => {
    const data: AnalyticsData[] = [];
    const now = new Date();
    let daysBack = 7;

    if (timeRange === '24h') daysBack = 1;
    else if (timeRange === '7d') daysBack = 7;
    else if (timeRange === '30d') daysBack = 30;
    else if (timeRange === '90d') daysBack = 90;

    for (let i = daysBack; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      data.push({
        timestamp: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        apiCalls: Math.floor(Math.random() * 50000) + 10000,
        databaseSize: Math.floor(Math.random() * 500) + 100,
        storageUsed: Math.floor(Math.random() * 1000) + 200,
        bandwidth: Math.floor(Math.random() * 5000) + 1000,
        activeUsers: Math.floor(Math.random() * 500) + 50,
      });
    }

    return data;
  }, [timeRange]);

  // Calculate summary statistics
  const summaryStats = useMemo((): SummaryStats => {
    const totalApiCalls = analyticsData.reduce((sum, d) => sum + d.apiCalls, 0);
    const totalDatabaseSize = analyticsData[analyticsData.length - 1]?.databaseSize || 0;
    const totalStorageUsed = analyticsData[analyticsData.length - 1]?.storageUsed || 0;
    const totalBandwidth = analyticsData.reduce((sum, d) => sum + d.bandwidth, 0);
    const totalActiveUsers = Math.max(...analyticsData.map(d => d.activeUsers));

    return {
      totalApiCalls,
      totalDatabaseSize,
      totalStorageUsed,
      totalBandwidth,
      totalActiveUsers,
      avgResponseTime: Math.floor(Math.random() * 200) + 50,
      errorRate: parseFloat((Math.random() * 0.5).toFixed(2)),
    };
  }, [analyticsData]);

  // Pie chart data for resource breakdown
  const resourceBreakdown = [
    { name: 'Database', value: 40 },
    { name: 'Storage', value: 35 },
    { name: 'Bandwidth', value: 15 },
    { name: 'Compute', value: 10 },
  ];

  const COLORS: string[] = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usage Analytics</h1>
          <p className="text-gray-600 mt-1">Monitor your project's resource usage and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-600" />
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total API Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{formatNumber(summaryStats.totalApiCalls)}</span>
              <span className="text-xs text-green-600 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> +12%
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">vs last period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Database Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{formatBytes(summaryStats.totalDatabaseSize * 1024 * 1024)}</span>
              <span className="text-xs text-blue-600 flex items-center gap-1">
                <Database className="w-3 h-3" /> Current
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">of 100 GB limit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Storage Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{formatBytes(summaryStats.totalStorageUsed * 1024 * 1024)}</span>
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <HardDrive className="w-3 h-3" /> Current
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">of 500 GB limit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Response Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{summaryStats.avgResponseTime}ms</span>
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Zap className="w-3 h-3" /> Good
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Error rate: {summaryStats.errorRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Calls Trend */}
        <Card>
          <CardHeader>
            <CardTitle>API Calls Trend</CardTitle>
            <CardDescription>Number of API requests over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={analyticsData}>
                <defs>
                  <linearGradient id="colorApiCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="apiCalls" stroke="#3b82f6" fillOpacity={1} fill="url(#colorApiCalls)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Database & Storage Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Storage Usage Trend</CardTitle>
            <CardDescription>Database and storage consumption over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="databaseSize" stroke="#10b981" name="Database (MB)" />
                <Line type="monotone" dataKey="storageUsed" stroke="#f59e0b" name="Storage (MB)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bandwidth Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Bandwidth Usage</CardTitle>
            <CardDescription>Data transfer over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="bandwidth" fill="#ef4444" name="Bandwidth (MB)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Resource Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Resource Breakdown</CardTitle>
            <CardDescription>Usage distribution by resource type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={resourceBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {resourceBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card>
          <CardHeader>
            <CardTitle>Active Users</CardTitle>
            <CardDescription>Concurrent users over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="activeUsers" stroke="#8b5cf6" name="Active Users" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Detailed Metrics Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Detailed Metrics</CardTitle>
            <CardDescription>Hour-by-hour breakdown of key metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Time</th>
                    <th className="text-right py-2 px-3 font-medium">API Calls</th>
                    <th className="text-right py-2 px-3 font-medium">DB Size</th>
                    <th className="text-right py-2 px-3 font-medium">Storage</th>
                    <th className="text-right py-2 px-3 font-medium">Bandwidth</th>
                    <th className="text-right py-2 px-3 font-medium">Users</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsData.slice(-10).map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3">{row.timestamp}</td>
                      <td className="text-right py-2 px-3">{formatNumber(row.apiCalls)}</td>
                      <td className="text-right py-2 px-3">{row.databaseSize} MB</td>
                      <td className="text-right py-2 px-3">{row.storageUsed} MB</td>
                      <td className="text-right py-2 px-3">{row.bandwidth} MB</td>
                      <td className="text-right py-2 px-3">{row.activeUsers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle>Export Analytics</CardTitle>
          <CardDescription>Download your analytics data for further analysis</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="outline">Export as CSV</Button>
          <Button variant="outline">Export as JSON</Button>
          <Button variant="outline">Generate Report</Button>
        </CardContent>
      </Card>
    </div>
  );
}
