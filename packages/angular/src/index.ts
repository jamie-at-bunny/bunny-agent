/**
 * @bunny.net/agent-angular — <bunny-agent-chat> Angular wrapper around
 * @bunny.net/agent-core. Import the base styles once (e.g. in angular.json):
 *
 *   "styles": ["node_modules/@bunny.net/agent-core/styles.css", ...]
 */

export type {
  AgentStatus,
  ChatItem,
  ToolErrorEvent,
  ToolSuccessEvent,
} from "@bunny.net/agent-core";
export {
  BunnyAgentChatComponent,
  type BunnyAgentUser,
} from "./bunny-agent-chat.component";
