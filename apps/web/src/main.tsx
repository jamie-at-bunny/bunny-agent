import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HomePage } from "./routes/home";
import { WidgetPage } from "./routes/widget";
import "@bunny-agent/react/styles.css";
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
