import { GradientMesh } from "@/components/marketing/GradientMesh";
import { Nav } from "@/components/marketing/Nav";
import { Hero } from "@/components/marketing/Hero";
import { FeaturesBento } from "@/components/marketing/FeaturesBento";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { AuthorNote } from "@/components/marketing/AuthorNote";
import { Footer } from "@/components/marketing/Footer";
import { LandingMotion } from "@/components/marketing/LandingMotion";

export default function LandingPage() {
  return (
    <>
      <GradientMesh />
      <Nav />
      <main>
        <Hero />
        <FeaturesBento />
        <HowItWorks />
        <AuthorNote />
      </main>
      <Footer />
      <LandingMotion />
    </>
  );
}
