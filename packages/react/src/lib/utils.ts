import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// All library utilities are compiled with the `ba` Tailwind prefix so they
// never collide with a consumer's own styles or Tailwind setup.
const twMerge = extendTailwindMerge({ prefix: "ba" })

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
