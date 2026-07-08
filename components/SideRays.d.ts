// Types for the React Bits SideRays.jsx component so it imports cleanly from
// strict TS/TSX. Runtime resolves to the .jsx; TypeScript to this declaration.
import type { ReactElement } from "react";

export interface SideRaysProps {
  speed?: number;
  rayColor1?: string;
  rayColor2?: string;
  intensity?: number;
  spread?: number;
  origin?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  tilt?: number;
  saturation?: number;
  blend?: number;
  falloff?: number;
  opacity?: number;
  className?: string;
}

declare const SideRays: (props: SideRaysProps) => ReactElement;
export default SideRays;
