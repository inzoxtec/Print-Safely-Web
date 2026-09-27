// app/shop/dashboard/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ShopOwnerDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard?tab=shop");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white">
      <div className="animate-spin h-8 w-8 text-blue-600 rounded-full border-4 border-t-transparent" />
    </div>
  );
}
