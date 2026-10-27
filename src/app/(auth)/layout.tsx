import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div aria-hidden className="ambient-glow -z-10 !inset-x-0 !top-[-10%] mx-auto max-w-3xl" />
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-10 text-center text-[12px] text-subtle">Ton centre de contrôle personnel.</p>
    </div>
  );
}
