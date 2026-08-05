import {
  FacebookLogo,
  InstagramLogo,
  TiktokLogo,
  WhatsappLogo,
  XLogo,
  YoutubeLogo,
} from "@phosphor-icons/react/dist/ssr";
import type { IconProps } from "@phosphor-icons/react";
import type { SocialPlatform } from "@/lib/supabase/types";

export const SOCIAL_PLATFORMS: {
  value: SocialPlatform;
  label: string;
  icon: React.ComponentType<IconProps>;
}[] = [
  { value: "instagram", label: "Instagram", icon: InstagramLogo },
  { value: "facebook", label: "Facebook", icon: FacebookLogo },
  { value: "tiktok", label: "TikTok", icon: TiktokLogo },
  { value: "whatsapp", label: "WhatsApp", icon: WhatsappLogo },
  { value: "twitter", label: "Twitter/X", icon: XLogo },
  { value: "youtube", label: "YouTube", icon: YoutubeLogo },
];

export function getSocialPlatformMeta(platform: string) {
  return SOCIAL_PLATFORMS.find((p) => p.value === platform) ?? null;
}
