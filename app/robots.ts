import type { MetadataRoute } from "next";
import { getAdminBasePath } from "@/lib/admin/path";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const consolePath = getAdminBasePath();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [consolePath, `${consolePath}/`, "/admin", "/admin/", "/xopl", "/xopl/"],
    },
  };
}
