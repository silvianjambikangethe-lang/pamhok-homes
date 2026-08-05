import {
  Bed,
  Broom,
  Car,
  Coffee,
  Fan,
  ForkKnife,
  Lock,
  ShieldCheck,
  Snowflake,
  TelevisionSimple,
  WifiHigh,
} from "@phosphor-icons/react/dist/ssr";
import type { IconProps } from "@phosphor-icons/react";

export const AMENITY_ICONS: Record<string, React.ComponentType<IconProps>> = {
  WifiHigh,
  Car,
  ForkKnife,
  Lock,
  Broom,
  ShieldCheck,
  Fan,
  TelevisionSimple,
  Coffee,
  Snowflake,
  Bed,
};

export const AMENITY_ICON_NAMES = Object.keys(AMENITY_ICONS);

export function getAmenityIcon(name: string) {
  return AMENITY_ICONS[name] ?? ShieldCheck;
}
