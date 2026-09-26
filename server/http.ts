import type { IncomingMessage, ServerResponse } from "node:http";
/** Structural subset of Vercel's Node request/response API, shared with local dev. */
export interface ApiRequest extends IncomingMessage {
  body: unknown;
}
export interface ApiResponse extends ServerResponse {
  status(code: number): ApiResponse;
  json(value: unknown): ApiResponse;
}
