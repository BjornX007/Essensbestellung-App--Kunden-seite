import Navbar from "@/components/layout/nav/Nav";
import Hero from "@/components/layout/hero/Hero";
import OpeningHours from "@/components/layout/opening-hours/OpeningHours";
import Footer from "@/components/layout/Footer";
import Gallery from "@/components/layout/gallery/gallery";
import ReviewsSection from "@/components/layout/reviews/ReviewsSection";
import CartPanel from "@/components/cart/CartPanel";  
export default function Home() {
  return (
    <>
      <main>
        <Navbar />
        <Hero />
         <Gallery />
        <OpeningHours />
        <ReviewsSection />
        <CartPanel />
      </main>

      <Footer />
    </>
  );
}