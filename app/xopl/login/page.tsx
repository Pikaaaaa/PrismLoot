import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLoginPage() {
  return <AdminLoginForm />;
}
