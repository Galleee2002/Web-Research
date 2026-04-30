import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hashes passwords with scrypt and verifies only the original password", async () => {
    const hash = await hashPassword("super-secret-123", {
      keyLength: 32,
      salt: "fixed-salt",
    });

    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$fixed-salt\$/);
    expect(hash).not.toContain("super-secret-123");
    await expect(verifyPassword("super-secret-123", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });
});
