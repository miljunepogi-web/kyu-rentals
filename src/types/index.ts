export type { Result } from "@/utils/response";
export type { ErrorCode } from "@/utils/errors";

export interface UserSession {
  id: string;
  email: string;
  role?: string;
}
