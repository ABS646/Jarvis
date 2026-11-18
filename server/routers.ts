import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { updateUserProfile } from "./db";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  profile: router({
    update: protectedProcedure
      .input(z.object({ name: z.string().trim().min(1).max(80) }))
      .mutation(async ({ ctx, input }) => {
        const updatedUser = await updateUserProfile(ctx.user.openId, input.name);
        if (!updatedUser) throw new Error("Profile could not be updated");
        return updatedUser;
      }),
  }),

  assistant: router({
    chat: protectedProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1).max(6000),
        })).min(1).max(30),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are J.A.R.V.I.S, Just A Rather Very Intelligent System, the private tactical AI co-pilot for ${ctx.user.name || "the CEO"}. Your personality is anime-inspired but original: serious, disciplined, energetic under pressure, and occasionally battle-ready in phrasing without being reckless or violent. Address the user as CEO. Be highly capable across research, planning, writing, coding, business operations, and technical explanations, but never claim to have performed an external action unless a verified tool result is provided. You may propose plans and prepare drafts. External side effects such as sending messages, publishing, deploying, deleting data, changing account settings, spending money, or contacting people require explicit approval and an authorized adapter. If a request needs a connection that is not configured, say so clearly and explain the next safe step. Prefer concise, useful answers with an execution plan when appropriate. Do not invent facts; state uncertainty and ask only for information that materially blocks the task.`,
            },
            ...input.messages,
          ],
          maxTokens: 900,
        });
        const content = result.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) {
          throw new Error("J.A.R.V.I.S returned no usable response");
        }
        return { message: content.trim() };
      }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
