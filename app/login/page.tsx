import { GradientMesh } from "@/components/marketing/GradientMesh";
import { AuthCard } from "@/components/auth/AuthCard";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    confirmEmail?: string;
    redirectTo?: string;
  }>;
}) {
  const params = await searchParams;
  const defaultMode = params.mode === "signup" ? "signup" : "signin";

  return (
    <>
      <GradientMesh />
      <AuthCard
        defaultMode={defaultMode}
        confirmEmail={params.confirmEmail === "1"}
        redirectTo={params.redirectTo ?? "/library"}
      />
    </>
  );
}
