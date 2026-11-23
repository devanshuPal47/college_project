import { api, ApiError } from "./api";

export type Feedback = { strengths: string[]; fixes: string[]; next_step: string };
export type ChatMsg = { role: "user" | "assistant"; content: string };

export const AiError = ApiError;

export const getFeedback = (payload: unknown) => api.post<Feedback>("/ai/feedback", payload);
export const chat = (payload: unknown) => api.post<{ reply: string }>("/ai/chat", payload).then((r) => r.reply);
