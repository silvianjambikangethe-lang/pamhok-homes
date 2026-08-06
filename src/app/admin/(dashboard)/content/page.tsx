import {
  getAboutContent,
  getAmenitiesContent,
  getContactContent,
  getHomepageContent,
  getNeighborhoodContent,
} from "@/lib/data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import HomepageContentForm from "@/components/admin/HomepageContentForm";
import AboutContentForm from "@/components/admin/AboutContentForm";
import AmenitiesContentForm from "@/components/admin/AmenitiesContentForm";
import ContactContentForm from "@/components/admin/ContactContentForm";
import NeighborhoodContentForm from "@/components/admin/NeighborhoodContentForm";
import SocialLinksForm from "@/components/admin/SocialLinksForm";

export default async function AdminContentPage() {
  const supabase = await createServerSupabaseClient();

  const [homepage, about, amenities, contact, neighborhood, { data: socialLinks }] =
    await Promise.all([
      getHomepageContent(),
      getAboutContent(),
      getAmenitiesContent(),
      getContactContent(),
      getNeighborhoodContent(),
      supabase.from("social_links").select("*").order("display_order", { ascending: true }),
    ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-h2 text-ink">Edit Content</h1>
        <p className="mt-1 text-sm text-ink/80">
          Changes here go live on the public site as soon as you save each
          section.
        </p>
      </div>

      <HomepageContentForm initial={homepage} />
      <AboutContentForm initial={about} />
      <AmenitiesContentForm initial={amenities} />
      <ContactContentForm initial={contact} />
      <NeighborhoodContentForm initial={neighborhood} />
      <SocialLinksForm initial={socialLinks ?? []} />
    </div>
  );
}
