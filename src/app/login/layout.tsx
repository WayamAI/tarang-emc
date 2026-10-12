import type { Metadata } from "next";
import type { ReactNode } from "react";

import { APP } from "@/lib/app";

export const metadata: Metadata = {
  title: `Sign in — ${APP.name}`,
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
