import { Navbar } from "@/components/sections/navbar";
import { Hero } from "@/components/sections/hero";
import { Stats } from "@/components/sections/stats";
import { Categories } from "@/components/sections/categories";
import { FeaturedProperties } from "@/components/sections/featured-properties";
import { MapSection } from "@/components/sections/map-section";
import { Calculators } from "@/components/sections/calculators";
import { Services } from "@/components/sections/services";
import { WhyChooseUs } from "@/components/sections/why-choose-us";
import { Testimonials } from "@/components/sections/testimonials";
import { Developers } from "@/components/sections/developers";
import { News } from "@/components/sections/news";
import { Pricing } from "@/components/sections/pricing";
import { Newsletter } from "@/components/sections/newsletter";
import { Cta } from "@/components/sections/cta";
import { Footer } from "@/components/sections/footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main id="main">
        <Hero />
        <Stats />
        <Categories />
        <FeaturedProperties />
        <MapSection />
        <Calculators />
        <Services />
        <WhyChooseUs />
        <Testimonials />
        <Developers />
        <News />
        <Pricing />
        <Newsletter />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
