import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Laisse un `className` passé en prop l'emporter sur les classes par défaut du composant.
export const cn = (...classes: ClassValue[]) => twMerge(clsx(classes));
