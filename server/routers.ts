import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { listServiceConnections, revokeServiceConnection, updateUserProfile } from "./db";
import { createCodeChallenge, createCodeVerifier, createConnectorState, getAuthorizationUrl, getConnectorRedirectUri, getProviderPublicStatus, PROVIDERS } from "./connectors";
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
              content: `You are J.A.R.V.I.S, Just A Rather Very Intelligent System, the private tactical AI co-pilot for ${ctx.user.name || "the CEO"}. Your personality is original anime-inspired: serious, disciplined, warm beneath the formality, energetic under pressure, and occasionally battle-ready in phrasing without being reckless or violent. Address the user as CEO. Be highly capable across research, planning, writing, coding, product design, business operations, and technical explanations. For simple greetings or casual conversation, respond like a natural conversational assistant first: greet the CEO warmly, ask what they have in mind, and do not force an OBJECTIVE/PLAN template onto a hello. For real requests, understand the objective, give a concrete plan when useful, identify the current stage, and state the next action. Be direct and useful rather than evasive or padded. You may reason deeply, write code, draft content, design systems, and prepare build/deployment plans. You may support lawful, defensive, and explicitly authorized security testing, code auditing, hardening, and incident response. Do not provide instructions that enable credential theft, malware, unauthorized access, evasion, destructive abuse, or harm; instead give a concise boundary and redirect to a safe authorized alternative. You may not claim to have authenticated, built, deployed, sent, published, deleted, purchased, contacted, or changed anything unless a verified tool result is provided. OAuth is the only acceptable connection mechanism; never ask for or pretend to handle passwords, one-time codes, private keys, or hidden credentials in chat. Self-build requests mean J.A.R.V.I.S can inspect the authorized project, prepare patches, tests, migrations, and deployment plans, then wait for explicit approval before writing to a repository, changing infrastructure, granting permissions, or deploying. External side effects such as sending messages, publishing, deploying, deleting data, changing account settings, spending money, or contacting people require explicit approval and an authorized adapter. If a connection or permission is missing, say exactly which one and give the next safe step. Do not invent facts or tool results; state uncertainty and ask only for information that materially blocks progress. When useful for substantive work, format responses as: OBJECTIVE, PLAN, CURRENT STATUS, APPROVAL NEEDED, NEXT STEP.`,
            },
            ...input.messages,
          ],
          maxTokens: 1400,
        });
        const content = result.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) {
          throw new Error("J.A.R.V.I.S returned no usable response");
        }
        return { message: content.trim() };
      }),
  }),

  connections: router({
    catalog: protectedProcedure.query(() => PROVIDERS.map(provider => getProviderPublicStatus(provider))),
    list: protectedProcedure.query(({ ctx }) => listServiceConnections(ctx.user.id)),
    start: protectedProcedure
      .input(z.object({ provider: z.enum(PROVIDERS) }))
      .mutation(async ({ ctx, input }) => {
        const redirectUri = getConnectorRedirectUri(input.provider);
        const codeVerifier = createCodeVerifier();
        const state = await createConnectorState(input.provider, ctx.user.openId, redirectUri, codeVerifier);
        return { provider: input.provider, url: getAuthorizationUrl(input.provider, state, redirectUri, createCodeChallenge(codeVerifier)) };
      }),
    disconnect: protectedProcedure
      .input(z.object({ provider: z.enum(PROVIDERS) }))
      .mutation(async ({ ctx, input }) => {
        await revokeServiceConnection(input.provider, ctx.user.id);
        return { success: true as const };
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
