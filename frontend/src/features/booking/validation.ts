import { z } from "zod";
export const detailsSchema = z.object({
  full_name: z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(2, "Please enter your full name.")
        .max(100, "Please use at most 100 characters."),
    ),
  phone: z
    .string()
    .trim()
    .refine(
      (v) =>
        !v ||
        (/^\+?[\d\s().-]+$/.test(v) &&
          v.replace(/\D/g, "").length >= 7 &&
          v.replace(/\D/g, "").length <= 15),
      "Enter 7–15 digits with an optional + country code.",
    ),
});
export type Details = z.infer<typeof detailsSchema>;
