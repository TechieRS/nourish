import { describe, it, expect } from "vitest";
import { detailsSchema } from "./validation";
describe("booking form validation", () => {
  it("requires a full name", () =>
    expect(detailsSchema.safeParse({ full_name: " ", phone: "" }).success).toBe(
      false,
    ));
  it("accepts a missing phone", () =>
    expect(
      detailsSchema.safeParse({ full_name: "Meera Iyer", phone: "" }).success,
    ).toBe(true));
  it.each(["abc1234567", "123", "+44+7700900123", "1234567890123456"])(
    "rejects invalid phone %s",
    (phone) =>
      expect(
        detailsSchema.safeParse({ full_name: "Fictional Client", phone })
          .success,
      ).toBe(false),
  );
  it.each(["+44 7700 900123", "98200 11111", "(202) 555-0123"])(
    "accepts international/local phone %s without inferring country",
    (phone) =>
      expect(
        detailsSchema.safeParse({ full_name: "Fictional Client", phone })
          .success,
      ).toBe(true),
  );
});
