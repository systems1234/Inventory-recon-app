import Navbar from "@/components/Navbar";
import InvestigationsClient from "./InvestigationsClient";

export default function InvestigationsPage() {
  return (
    <main>
      <Navbar />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 sm:py-6">
        {/* <h1 className="font-display font-semibold text-2xl sm:text-3xl text-ink mb-4 sm:mb-5">Investigations</h1> */}
        <InvestigationsClient />
      </div>
    </main>
  );
}
