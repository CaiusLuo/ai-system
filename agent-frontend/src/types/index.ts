// 统一类型定义 - 与后端 DTO 完全对齐

// ==================== 认证相关 ====================

export interface LoginParams {
  username: string;
  password: string;
}

export interface RegisterParams {
  username: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  userId: number;
  username: string;
  role: 'ADMIN' | 'USER';
  expiresAt?: number;
  expiresInSeconds?: number;
}

// ==================== 用户相关 ====================

export interface UserDTO {
  id: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'USER';
  status: number;            // 1 = 启用，0 = 禁用
  statusText: 'ACTIVE' | 'DISABLED';
}

export interface UpdateUserParams {
  username?: string;
  email?: string;
  password?: string;
}

// ==================== 会话相关 ====================

export interface ConversationDTO {
  id: number;
  userId: number;
  title: string;
  lastMessageContent: string | null;  // 最新消息内容（预览）
  lastMessageTime: string | null;     // 最新消息时间（ISO 8601）
  createdAt: string;
  updatedAt: string;
}

// ==================== 消息相关 ====================

export interface MessageDTO {
  id: number;
  conversationId: number;
  userId: number;
  username: string | null;   // 发送者用户名
  role: 'user' | 'assistant';
  content: string;
  title: string | null;      // 消息标题
  createdAt: string;
  updatedAt: string;
}

// ==================== SSE 流式对话 ====================

export interface StreamChatParams {
  message: string;             // 必填：用户消息
  conversationId?: number;     // 可选：已有会话 ID
  sessionId?: string;          // 可选：会话标识
}

export interface SSEChunkData {
  type: 'chunk';
  content: string;
  index: number;
  reasoning?: string;         // 思考过程内容
  info?: string;              // 额外信息（别名）
  conversationId?: number;    // 首次响应可能包含 conversationId
  messageId?: string;         // 后端生成的消息 ID（备用）
}

export interface SEDoneData {
  type: 'done';
  total_tokens: number;       // 总 token 数
  conversationId?: number;    // 会话 ID
  messageId: string;          // 后端生成的消息 ID（推荐，在 done 事件中返回）
  info?: string;              // 额外信息
}

export interface SEEErrorData {
  type: 'error';
  message: string;
}

export interface SEPingData {
  type: 'ping';
}

export type SSEEventData = SSEChunkData | SEDoneData | SEEErrorData | SEPingData;

// ==================== 管理员相关 ====================

export interface AdminUserDTO {
  id: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
}

export interface UserListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  role?: 'ADMIN' | 'USER';
  status?: 'ACTIVE' | 'DISABLED';
}

export interface UserListResponse {
  list: AdminUserDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateUserParams {
  username: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'DISABLED';
}

export interface UpdateAdminUserParams {
  username?: string;
  email?: string;
  password?: string;
  role?: 'ADMIN' | 'USER';
  status?: 'ACTIVE' | 'DISABLED';
}

// ==================== 工具类型 ====================

// 前端本地消息类型（用于 UI 展示）
export interface Message {
  id?: number;
  conversationId?: number;
  userId?: number;
  username?: string | null;
  role: 'user' | 'assistant';
  content: string;
  title?: string | null;
  reasoning?: string;         // 思考过程内容（前端扩展）
  createdAt?: string;
  updatedAt?: string;
}

// 前端本地会话类型（用于 localStorage）
export interface LocalConversation {
  id: string;                 // 本地 ID
  backendId: number | null;   // 后端会话 ID
  title: string;
  lastMessageContent: string | null;
  lastMessageTime: string | null;
  updatedAt: number;          // 本地时间戳
  createdAt: number;
}
