// ── MCP Servers ─────────────────────────────────────────────────────

export interface McpServer {
  type: 'url';
  name: string;
  url: string;
  headers?: Record<string, string>;
}

// ── Tools ───────────────────────────────────────────────────────────

export interface PermissionPolicy {
  type: 'always_allow' | 'always_ask';
}

export interface ToolConfig {
  name?: string;
  enabled: boolean;
  permission_policy: PermissionPolicy;
}

export interface AgentToolset {
  type: 'agent_toolset_20260401';
  default_config: ToolConfig;
  configs?: ToolConfig[];
}

export interface McpToolset {
  type: 'mcp_toolset';
  mcp_server_name: string;
  default_config: ToolConfig;
  configs?: ToolConfig[];
}

export interface CustomTool {
  type: 'custom';
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export type Tool = AgentToolset | McpToolset | CustomTool;

// ── Callable Agents ─────────────────────────────────────────────────

export interface CallableAgent {
  type: 'agent';
  id: string;
  version: number;
}

// ── Skills ──────────────────────────────────────────────────────────

export interface SkillReference {
  type: 'custom' | 'anthropic';
  skill_id: string;
  version: 'latest' | string;
}

export interface SkillCreateParams {
  name: string;
  description: string;
  content: string;
  reference_files?: { name: string; content: string }[];
}

export interface Skill {
  id: string;
  name: string;
  display_title: string;
  description: string;
  version: string;
  created_at: string;
  updated_at: string;
  type: 'skill';
}

// ── Environments ────────────────────────────────────────────────────

export interface UnrestrictedNetwork {
  type: 'unrestricted';
}

export interface LimitedNetwork {
  type: 'limited';
  allowed_hosts?: string[];
  allow_mcp_servers?: boolean;
  allow_package_managers?: boolean;
}

export interface CloudConfig {
  type: 'cloud';
  networking: UnrestrictedNetwork | LimitedNetwork;
  packages?: {
    apt?: string[];
    pip?: string[];
    npm?: string[];
    cargo?: string[];
    gem?: string[];
    go?: string[];
  };
}

export interface EnvironmentCreateParams {
  name: string;
  config: CloudConfig;
}

export interface Environment {
  id: string;
  name: string;
  config: CloudConfig;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  type: 'environment';
}

// ── Agent ───────────────────────────────────────────────────────────

export interface AgentCreateParams {
  name: string;
  model: string | { id: string; speed: 'standard' | 'fast' };
  description: string;
  system: string;
  mcp_servers: McpServer[];
  tools: Tool[];
  skills?: SkillReference[];
  callable_agents?: CallableAgent[];
  metadata?: Record<string, string>;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  model: { id: string; speed: string };
  system: string;
  mcp_servers: McpServer[];
  tools: Tool[];
  callable_agents?: CallableAgent[];
  metadata: Record<string, string>;
  version: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  type: 'agent';
}

// ── Sessions ────────────────────────────────────────────────────────

export interface SessionCreateParams {
  agent: string | { type: 'agent'; id: string; version: number };
  environment_id: string;
  title?: string;
  metadata?: Record<string, string>;
  resources?: GitRepoResource[];
  vault_ids?: string[];
}

export interface SessionUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
}

export interface Session {
  id: string;
  agent: Agent;
  environment_id: string | null;
  status: 'idle' | 'running' | 'rescheduling' | 'terminated';
  title: string | null;
  metadata: Record<string, string>;
  usage: SessionUsage;
  stats: { duration_seconds: number; active_seconds: number };
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  type: 'session';
}

// ── Events ──────────────────────────────────────────────────────────

export interface TextContent {
  type: 'text';
  text: string;
}

export interface UserMessageEvent {
  type: 'user.message';
  content: TextContent[];
}

export interface UserInterruptEvent {
  type: 'user.interrupt';
}

export interface ToolConfirmationEvent {
  type: 'user.tool_confirmation';
  tool_use_id: string;
  result: 'allow' | 'deny';
  session_thread_id?: string;
}

export interface UserCustomToolResultEvent {
  type: 'user.custom_tool_result';
  custom_tool_use_id: string;
  content: TextContent[];
  is_error?: boolean;
}

export type UserEvent = UserMessageEvent | UserInterruptEvent | ToolConfirmationEvent | UserCustomToolResultEvent;

export interface AgentMessageEvent {
  type: 'agent.message';
  id: string;
  content: TextContent[];
  processed_at: string;
}

export interface AgentToolUseEvent {
  type: 'agent.tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
  processed_at: string;
}

export interface AgentToolResultEvent {
  type: 'agent.tool_result';
  id: string;
  tool_use_id: string;
  content: TextContent[];
  is_error: boolean;
  processed_at: string;
}

export interface AgentCustomToolUseEvent {
  type: 'agent.custom_tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
  processed_at: string;
}

export interface AgentMcpToolUseEvent {
  type: 'agent.mcp_tool_use';
  id: string;
  name: string;
  server_name: string;
  input: Record<string, unknown>;
  processed_at: string;
}

export interface AgentMcpToolResultEvent {
  type: 'agent.mcp_tool_result';
  id: string;
  tool_use_id: string;
  content: TextContent[];
  is_error: boolean;
  processed_at: string;
}

export interface AgentThinkingEvent {
  type: 'agent.thinking';
  id: string;
  processed_at: string;
}

export interface AgentThreadContextCompactedEvent {
  type: 'agent.thread_context_compacted';
  id: string;
  processed_at: string;
}

export interface AgentThreadMessageSentEvent {
  type: 'agent.thread_message_sent';
  id: string;
  session_thread_id: string;
  processed_at: string;
}

export interface AgentThreadMessageReceivedEvent {
  type: 'agent.thread_message_received';
  id: string;
  session_thread_id: string;
  processed_at: string;
}

export interface SessionStatusEvent {
  type: 'session.status_running' | 'session.status_idle' | 'session.status_rescheduled' | 'session.status_terminated';
  id: string;
  stop_reason?: { type: string; event_ids?: string[] };
  processed_at: string;
}

export interface SessionThreadCreatedEvent {
  type: 'session.thread_created';
  id: string;
  session_thread_id: string;
  processed_at: string;
}

export interface SessionThreadIdleEvent {
  type: 'session.thread_idle';
  id: string;
  session_thread_id: string;
  processed_at: string;
}

export interface SpanModelRequestEndEvent {
  type: 'span.model_request_end';
  id: string;
  is_error: boolean;
  model_usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    speed?: 'standard' | 'fast';
  };
  processed_at: string;
}

export interface SessionErrorEvent {
  type: 'session.error';
  id: string;
  error: { type: string; message: string };
  processed_at: string;
}

export type AgentEvent =
  | AgentMessageEvent
  | AgentToolUseEvent
  | AgentToolResultEvent
  | AgentCustomToolUseEvent
  | AgentMcpToolUseEvent
  | AgentMcpToolResultEvent
  | AgentThinkingEvent
  | AgentThreadContextCompactedEvent
  | AgentThreadMessageSentEvent
  | AgentThreadMessageReceivedEvent
  | SpanModelRequestEndEvent
  | SessionStatusEvent
  | SessionThreadCreatedEvent
  | SessionThreadIdleEvent
  | SessionErrorEvent;

// ── Paginated Response ──────────────────────────────────────────────

export interface Paginated<T> {
  data: T[];
  next_page: string | null;
}

// ── Team ────────────────────────────────────────────────────────────

export type TeamGroup = 'factory' | 'firm' | 'lab';

export type TeamRole =
  | 'coordinator'
  | 'product'
  | 'product-research'
  | 'product-growth'
  | 'design'
  | 'design-ux'
  | 'design-accessibility'
  | 'engineering'
  | 'eng-frontend'
  | 'eng-backend'
  | 'eng-ai'
  | 'eng-infra'
  | 'eng-perf'
  | 'eng-devex'
  | 'qa'
  | 'qa-automation'
  | 'qa-security'
  | 'qa-data'
  | 'sales'
  | 'sales-solutions'
  | 'marketing'
  | 'marketing-content'
  | 'marketing-seo'
  | 'operations'
  | 'ops-sre'
  | 'ops-incident'
  | 'ops-finops'
  | 'ops-compliance'
  | 'customer-success'
  | 'cs-support'
  | 'cs-renewals'
  | 'data-analyst'
  | 'tech-writer'
  | 'chief-of-staff'
  | 'brand-strategist'
  | 'legal'
  | 'lead-inbound'
  | 'lead-outbound'
  | 'lead-research'
  | 'lead-partnerships'
  | 'lead-social'
  | 'lead-events'
  | 'lead-referral'
  | 'biz-dev'
  | 'ux-writer'
  | 'eng-mobile'
  | 'qa-ux'
  | 'sales-ops'
  | 'marketing-email'
  | 'ops-automation'
  | 'prompt-optimizer'
  | 'build-verifier'
  | 'artifact-auditor'
  | 'pr-reviewer'
  | 'devrel'
  | 'compliance-automation'
  | 'template-quality'
  | 'cross-project-learner'
  | 'scaffold-validator'
  | 'release-manager'
  | 'client-packager'
  | 'session-analyst'
  | 'intake-analyst'
  | 'onboarding-tester'
  | 'external-reviewer';

export interface TeamMember {
  role: TeamRole;
  group?: TeamGroup;
  name: string;
  model: string;
  description: string;
  system: string;
  mcpServers: string[]; // server names from mcp.ts registry
  briefTemplate?: string; // nanohype brief template name for skill generation
}

// ── Git Resources ───────────────────────────────────────────────────

export interface GitRepoResource {
  type: 'github_repository';
  url: string;
  authorization_token: string;
  mount_path?: string;
  checkout?: { type: 'branch'; name: string };
}

// ── Workflow Gates ──────────────────────────────────────────────────

export type GateDecision = 'approve' | 'revise' | 'reject';

export interface GateResult {
  decision: GateDecision;
  feedback?: string;
}

// ── Sprint ──────────────────────────────────────────────────────────

export interface SprintItem {
  id: string;
  description: string;
  assignedTo: TeamRole;
  status: 'backlog' | 'in-progress' | 'blocked' | 'done';
  blockedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SprintConfig {
  sessionId: string;
  cadence: 'daily' | 'weekly' | 'biweekly';
  nextStandup: string;
  backlog: SprintItem[];
  currentSprint: number;
}

// ── Language dispatch ───────────────────────────────────────────────
//
// Primary language for a factory build. Drives LANGUAGE_TOOLCHAIN
// (standards.ts) — build/lint/test/docs commands, manifest file,
// version-lookup command, registry. Populated from the intake brief's
// constraints.language and persisted on SpasticState.

export type Language = 'typescript' | 'go' | 'python' | 'rust' | 'java' | 'kotlin' | 'csharp';

// ── Local State ─────────────────────────────────────────────────────

export interface MemoryConfig {
  enabled: boolean;
  path: string;
}

export interface JournalConfig {
  enabled: boolean;
  basePath: string;
}

export interface DeployedAgent {
  role: TeamRole;
  agentId: string;
  version: number;
  deployedAt: string;
}

export interface SpasticState {
  agents: DeployedAgent[];
  coordinatorId: string | null;
  skillIds: Record<string, string>;
  environmentId: string | null;
  memory: MemoryConfig;
  journal: JournalConfig;
  repos: GitRepoResource[];
  modelOverrides: Record<string, string>;
  sprint: SprintConfig | null;
  vaultIds: string[];
  budgetLimit: number | null;
  projectLanguage: Language;
}
