"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function FAQAccordion() {
  const faqs = [
    {
      q: "How far in advance should I book my karaoke rental?",
      a: "We recommend booking at least 3 to 7 days in advance, especially for weekend events (Friday to Sunday) when demand is highest. However, we also accept same-day bookings subject to equipment availability.",
    },
    {
      q: "What is included in the free delivery service?",
      a: "Free delivery and setup are included for Metro Manila locations within a 10km radius from our main hub. Deliveries beyond 10km or outside Metro Manila (Rizal, Cavite, Laguna) incur a nominal distance surcharge calculated during checkout.",
    },
    {
      q: "How does the reservation payment work?",
      a: "You only pay a 30% reservation fee online (via GCash, PayMongo, Maya, or Credit Card) to lock in your date. The remaining 70% balance is collected upon equipment delivery and setup at your venue.",
    },
    {
      q: "Are the microphones and equipment sanitized?",
      a: "Yes! Every microphone features a fresh, disposable foam cover and goes through UV-C sterilization before and after every rental.",
    },
    {
      q: "Can I connect my own phone or laptop for YouTube music?",
      a: "Yes! All KYU setups include Bluetooth 5.0, AUX 3.5mm, and HDMI connectivity so you can stream backing tracks or play music directly from your smartphone or tablet.",
    },
  ];

  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="font-outfit text-3xl font-bold tracking-tight sm:text-4xl">Frequently Asked Questions</h2>
          <p className="mt-3 text-muted-foreground">Everything you need to know about our rental process and equipment.</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div key={idx} className="rounded-xl border bg-card overflow-hidden transition-all">
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between p-5 text-left font-semibold text-foreground text-base focus:outline-none"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180 text-primary" : ""}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
