import { twMerge } from 'tailwind-merge'

export function cn(...classes: (string | boolean | null | undefined)[]) {
  return twMerge(classes.filter(Boolean).join(' '))
}
