import {
  BunnyAgentChat,
  BunnyAgentLauncher,
  BunnyAgentProvider,
  BunnyAgentWindow,
} from "@bunny.net/agent-react";
import { useAgentStatus } from "../status";

export function HomePage() {
  const status = useAgentStatus();

  return (
    <main className="page">
      <header className="page__header">
        <span className="page__logo">🐰</span>
        <div>
          <h1>Bunny Agent</h1>
          <p>
            Create databases, storage buckets, and pull zones in plain English.
            {status.data?.bunny.email && (
              <> Connected as {status.data.bunny.email}.</>
            )}
          </p>
        </div>
      </header>
      <BunnyAgentChat user={{ name: "Jamie" }} persist />
      <footer className="page__footer">
        Embed this agent anywhere:{" "}
        <code>
          &lt;script src="&lt;this-origin&gt;/embed.js"&gt;&lt;/script&gt;
        </code>{" "}
        or <code>&lt;BunnyAgentChat /&gt;</code> from{" "}
        <code>@bunny.net/agent-react</code>
      </footer>
      {/* The launcher/window pair from @bunny.net/agent-react — the React-native
          equivalent of the embed.js floating widget. Separate persist key so
          it doesn't share a transcript with the inline chat above. */}
      <BunnyAgentProvider>
        <BunnyAgentLauncher />
        <BunnyAgentWindow>
          <BunnyAgentChat compact persist="bunny-agent-widget" />
        </BunnyAgentWindow>
      </BunnyAgentProvider>
    </main>
  );
}
