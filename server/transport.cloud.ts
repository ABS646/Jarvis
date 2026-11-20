import type { SendInput, Transport } from "./transport";

export function cloudTransport(_accountId: number): Transport {
  return {
    async send(_input: SendInput) {
      throw new Error("Cloud API not configured");
    },
  };
}
