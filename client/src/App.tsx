import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Organizations from "./pages/Organizations";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import EdgeFunctions from "./pages/EdgeFunctions";
import Realtime from "./pages/Realtime";
import Usage from "./pages/Usage";
import Billing from "./pages/Billing";
import Settings from "./pages/Settings";
import AdminPanel from "./pages/AdminPanel";
import Studio from "./pages/Studio";
import TeamCollaboration from "./pages/TeamCollaboration";
import OrganizationDetail from "./pages/OrganizationDetail";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/organizations"} component={Organizations} />
      <Route path={"/organizations/:id"} component={OrganizationDetail} />
      <Route path={"/organizations/:id/team"} component={TeamCollaboration} />
      <Route path={"/projects"} component={Projects} />
      <Route path={"/projects/:id"} component={ProjectDetail} />
      <Route path={"/projects/:id/studio"} component={Studio} />
      <Route path={"/projects/:id/functions"} component={EdgeFunctions} />
      <Route path={"/projects/:id/realtime"} component={Realtime} />
      <Route path={"/projects/:id/usage"} component={Usage} />
      <Route path={"/billing"} component={Billing} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/admin"} component={AdminPanel} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
