// 會員系統 API 入口（程式在 lib/member/core.js）
import { handle } from '../../lib/member/core.js';
export const onRequest = ({ request, env }) => handle(request, env);
