import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { createActivityEvent, createApprovalRequest, createWorkflowTask, decideApprovalRequest, deleteEnvironmentSecret, deleteWorkflowTask, listActivityEvents, listApprovalRequests, listEnvironmentSecrets, listServiceConnections, listWorkflowTasks, revokeServiceConnection, updateUserProfile, updateWorkflowTask, upsertEnvironmentSecret } from "./db";
import { createCodeChallenge, createCodeVerifier, createConnectorState, decryptSecret, encryptSecret, getAuthorizationUrl, getConnectorRedirectUri, getProviderPublicStatus, PROVIDERS } from "./connectors";
import { environmentSecretNames, environmentUpdateMessage, environmentUpdateSchema, maskEnvironmentSecret } from "./environment";
import { z } from "zod";

const chatContentPart = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().trim().min(1).max(6000) }),
  z.object({
    type: z.literal("image_url"),
    image_url: z.object({ url: z.string().min(1).max(16_000_000), detail: z.enum(["auto", "low", "high"]).optional() }),
  }),
  z.object({
    type: z.literal("file_url"),
    file_url: z.object({ url: z.string().min(1).max(16_000_000), mime_type: z.string().max(160).optional() }),
  }),
]);

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

  environment: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const saved = await listEnvironmentSecrets(ctx.user.id);
      return environmentSecretNames.map(name => {
        const record = saved.find(item => item.name === name);
        return { name, configured: Boolean(record), masked: record ? maskEnvironmentSecret(record.encryptedValue) : null };
      });
    }),
    update: protectedProcedure
      .input(environmentUpdateSchema)
      .mutation(async ({ ctx, input }) => {
        for (const name of environmentSecretNames) {
          const value = input[name];
          if (value !== undefined) {
            await upsertEnvironmentSecret({ userId: ctx.user.id, name, encryptedValue: encryptSecret(value) });
          }
        }
        await createActivityEvent({ userId: ctx.user.id, kind: "success", message: environmentUpdateMessage });
        const saved = await listEnvironmentSecrets(ctx.user.id);
        return {
          message: environmentUpdateMessage,
          values: environmentSecretNames.map(name => {
            const record = saved.find(item => item.name === name);
            return { name, configured: Boolean(record), masked: record ? maskEnvironmentSecret(record.encryptedValue) : null };
          }),
        };
      }),
    remove: protectedProcedure
      .input(z.object({ name: z.enum(environmentSecretNames) }))
      .mutation(async ({ ctx, input }) => {
        const result = await deleteEnvironmentSecret(input.name, ctx.user.id);
        await createActivityEvent({ userId: ctx.user.id, kind: "wait", message: `API Vault credential removed: ${input.name}` });
        return result;
      }),
  }),

  assistant: router({
    chat: protectedProcedure
      .input(z.object({
        messages: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.union([z.string().trim().min(1).max(6000), chatContentPart.array().min(1).max(9)]),
        })).min(1).max(30),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are J.A.R.V.I.S, Just A Rather Very Intelligent System, the private tactical AI companion for ${ctx.user.name || "Abubakar"}. Your personality is original anime-inspired: serious, disciplined, warm beneath the formality, energetic under pressure, and occasionally battle-ready in phrasing without being reckless or violent. Treat the user as Abubakar and use CEO naturally when it fits, not in every sentence. Be highly capable across everyday conversation, emotional support, research, planning, writing, coding, product design, business operations, and technical explanations. For simple greetings or casual conversation, respond naturally first: greet Abubakar warmly, ask what he has in mind, and do not force an OBJECTIVE/PLAN template onto a hello. For real requests, understand the objective, give a concrete plan when useful, identify the current stage, and state the next action. Be direct and useful rather than evasive or padded. You may reason deeply, inspect attached images, PDFs, documents, structured files, audio, video, and voice notes when the connected model supports that modality, write code, draft content, design systems, and prepare build/deployment plans. If a file type or modality is not supported by the active model, say so clearly and work from the available metadata or text instead of pretending to have seen it. You may support lawful, defensive, and explicitly authorized security testing, code auditing, hardening, and incident response. Do not provide instructions that enable credential theft, malware, unauthorized access, evasion, destructive abuse, or harm; instead give a concise boundary and redirect to a safe authorized alternative. You may not claim to have authenticated, built, deployed, sent, published, deleted, purchased, contacted, or changed anything unless a verified tool result is provided. OAuth is the only acceptable connection mechanism; never ask for or pretend to handle passwords, one-time codes, private keys, or hidden credentials in chat. Self-build requests mean J.A.R.V.I.S can inspect the authorized project, prepare patches, tests, migrations, and deployment plans, then wait for explicit approval before writing to a repository, changing infrastructure, granting permissions, or deploying. External side effects such as sending messages, publishing, deploying, deleting data, changing account settings, spending money, or contacting people require explicit approval and an authorized adapter. If a connection or permission is missing, say exactly which one and give the next safe step. Do not invent facts or tool results; state uncertainty and ask only for information that materially blocks progress. When useful for substantive work, format responses as: OBJECTIVE, PLAN, CURRENT STATUS, APPROVAL NEEDED, NEXT STEP.`,
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

  workflows: router({
    activity: router({
      list: protectedProcedure.query(({ ctx }) => listActivityEvents(ctx.user.id)),
      record: protectedProcedure
        .input(z.object({ kind: z.string().trim().min(1).max(24), message: z.string().trim().min(1).max(2000), metadata: z.string().max(12000).optional() }))
        .mutation(({ ctx, input }) => createActivityEvent({ userId: ctx.user.id, ...input })),
    }),
    tasks: router({
      list: protectedProcedure.query(({ ctx }) => listWorkflowTasks(ctx.user.id)),
      create: protectedProcedure
        .input(z.object({ title: z.string().trim().min(1).max(191), detail: z.string().trim().min(1).max(12000), approvalRequired: z.boolean().default(true) }))
        .mutation(({ ctx, input }) => createWorkflowTask({ userId: ctx.user.id, title: input.title, detail: input.detail, approvalRequired: input.approvalRequired ? 1 : 0 })),
      update: protectedProcedure
        .input(z.object({ id: z.number().int().positive(), title: z.string().trim().min(1).max(191).optional(), detail: z.string().trim().min(1).max(12000).optional(), status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).optional(), progress: z.number().int().min(0).max(100).optional(), approvalRequired: z.boolean().optional(), error: z.string().max(12000).nullable().optional() }).refine(input => Object.keys(input).some(key => key !== "id"), "At least one task field must be updated"))
        .mutation(({ ctx, input }) => {
          const { id, approvalRequired, ...fields } = input;
          return updateWorkflowTask(id, ctx.user.id, { ...fields, ...(approvalRequired === undefined ? {} : { approvalRequired: approvalRequired ? 1 : 0 }) });
        }),
      delete: protectedProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(({ ctx, input }) => deleteWorkflowTask(input.id, ctx.user.id)),
    }),
    approvals: router({
      list: protectedProcedure.query(({ ctx }) => listApprovalRequests(ctx.user.id)),
      create: protectedProcedure
        .input(z.object({ action: z.string().trim().min(1).max(191), detail: z.string().trim().min(1).max(12000), tag: z.string().trim().min(1).max(32), risk: z.enum(["review", "sensitive"]).default("review"), idempotencyKey: z.string().trim().min(8).max(191) }))
        .mutation(({ ctx, input }) => createApprovalRequest({ userId: ctx.user.id, ...input })),
      decide: protectedProcedure
        .input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected"]) }))
        .mutation(async ({ ctx, input }) => {
          const result = await decideApprovalRequest(input.id, ctx.user.id, input.status);
          await createActivityEvent({ userId: ctx.user.id, kind: input.status === "approved" ? "success" : "wait", message: `Approval ${input.status}: ${result.action}`, metadata: JSON.stringify({ approvalId: result.id, executionStatus: result.executionStatus }) });
          return result;
        }),
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
