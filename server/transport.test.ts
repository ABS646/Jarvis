import { describe, expect, it } from "vitest";
import { getTransport } from "./transport";

describe("cloud transport", () => {
  it("resolves to a transport with send", async () => {
    const transport = await getTransport(1);
    expect(transport.send).toBeTypeOf("function");
  });

  it("reports when the cloud API is not configured", async () => {
    const transport = await getTransport(1);
    await expect(transport.send({ to: "15551234567", body: "test" })).rejects.toThrow("Cloud API not configured");
  });
});
