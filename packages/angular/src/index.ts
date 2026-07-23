/**
 * @bunny-agent/angular — <bunny-agent-chat> Angular wrapper around
 * @bunny-agent/core. Import the base styles once (e.g. in angular.json):
 *
 *   "styles": ["node_modules/@bunny-agent/core/styles.css", ...]
 */
export {
  BunnyAgentChatComponent,
  type BunnyAgentUser,
} from "./bunny-agent-chat.component";

export type {
  AgentStatus,
  ChatItem,
  ToolErrorEvent,
  ToolSuccessEvent,
} from "@bunny-agent/core";
