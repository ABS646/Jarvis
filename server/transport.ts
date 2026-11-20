export type SendInput = { to: string; body: string; assetPath?: string; assetMime?: string };
export interface Transport { send(input: SendInput): Promise<{ ok: boolean; id?: string }> }

export async function getTransport(_accountId: number): Promise<Transport> {
  const { cloudTransport } = await import("./transport.cloud");
  return cloudTransport(_accountId);
}
