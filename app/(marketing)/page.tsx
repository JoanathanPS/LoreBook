import { GradientMesh } from "@/components/marketing/GradientMesh";
import { Nav } from "@/components/marketing/Nav";
import { Hero } from "@/components/marketing/Hero";
import { FeaturesBento } from "@/components/marketing/FeaturesBento";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { Footer } from "@/components/marketing/Footer";

export default function LandingPage() {
  return (
    <>
      <GradientMesh />
      <Nav />
      <main>
        <Hero />
        <FeaturesBento />
        <HowItWorks />
      </main>
      <Footer />
    </>
  );
}
