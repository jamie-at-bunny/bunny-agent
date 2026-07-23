import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HomePage } from "./routes/home";
import { WidgetPage } from "./routes/widget";
import "@bunny.net/agent-react/styles.css";
import "./styles.css";

const queryClient = new QueryClient();

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const widgetRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/widget",
  component: WidgetPage,
});

const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, widgetRoute]),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("index.html is missing #root");

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
