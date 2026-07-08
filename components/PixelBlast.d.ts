// Types for the React Bits PixelBlast.jsx registry component so it can be
// imported from strict TS/TSX without enabling allowJs. Runtime resolves to
// the .jsx; TypeScript resolves to this declaration.
import type { CSSProperties, ReactElement } from "react";

export interface PixelBlastProps {
  variant?: "square" | "circle" | "triangle" | "diamond";
  pixelSize?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
  antialias?: boolean;
  patternScale?: number;
  patternDensity?: number;
  liquid?: boolean;
  liquidStrength?: number;
  liquidRadius?: number;
  pixelSizeJitter?: number;
  enableRipples?: boolean;
  rippleIntensityScale?: number;
  rippleThickness?: number;
  rippleSpeed?: number;
  liquidWobbleSpeed?: number;
  autoPauseOffscreen?: boolean;
  speed?: number;
  transparent?: boolean;
  edgeFade?: number;
  noiseAmount?: number;
}

declare const PixelBlast: (props: PixelBlastProps) => ReactElement;
export default PixelBlast;
