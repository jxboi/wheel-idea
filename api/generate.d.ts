import type { ApiRequest, ApiResponse } from "../server/http";

export const config: { maxDuration: number };
declare const handler: (
  req: ApiRequest,
  res: ApiResponse,
) => Promise<ApiResponse>;
export default handler;
