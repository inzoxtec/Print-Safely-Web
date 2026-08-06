// app/login/layout.tsx
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Log in to your SafelyPrint account to manage secure document links.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}