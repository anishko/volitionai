// Types for the HeroSection.jsx component so it imports cleanly from strict
// TS/TSX. Runtime resolves to the .jsx; TypeScript to this declaration.
import type { ReactElement, ReactNode } from "react";

export interface HeroNavItem {
  id: string;
  label: string;
  href?: string;
  target?: string;
  onClick?: () => void;
}

export interface HeroSectionProps {
  heading?: string;
  tagline?: string;
  buttonText?: string;
  buttonHref?: string;
  onButtonClick?: () => void;
  imageUrl?: string;
  videoUrl?: string;
  placeholder?: ReactNode;
  navItems?: HeroNavItem[];
}

export declare const HeroSection: (props: HeroSectionProps) => ReactElement;
