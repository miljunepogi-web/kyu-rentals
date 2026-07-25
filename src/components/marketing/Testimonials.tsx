import { Star, Quote } from "lucide-react";

export function Testimonials() {
  const reviews = [
    {
      name: "Maria Santos",
      role: "Homeowner in Quezon City",
      comment: "Super ganda ng sound! Crisp microphones and the latest songs were all there. The setup driver arrived 30 mins early and explained how to use the tablet controller easily.",
      rating: 5,
      event: "50th Birthday Party",
    },
    {
      name: "Mark Tan",
      role: "Corporate Event Manager",
      comment: "Rented the Concert Master setup for our company year-end party in BGC. Excellent bass output and zero mic feedback. Will definitely book KYU Rentals again!",
      rating: 5,
      event: "Company Year-End Party",
    },
    {
      name: "Rhea Dela Cruz",
      role: "Condo Resident in Makati",
      comment: "The KYU Mini Party package was perfect for our condo function room. Very easy 5-minute online booking. Transparent pricing with no surprise delivery fees.",
      rating: 5,
      event: "Graduation Celebration",
    },
  ];

  return (
    <section className="bg-secondary/30 py-16 md:py-24 border-y">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-outfit text-3xl font-bold tracking-tight sm:text-4xl">Loved By Party Hosts</h2>
          <p className="mt-3 text-muted-foreground">
            See what our customers say about our equipment quality and on-time delivery service.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {reviews.map((rev, idx) => (
            <div key={idx} className="flex flex-col justify-between rounded-2xl border bg-card p-6 shadow-xs relative">
              <Quote className="absolute top-4 right-4 h-8 w-8 text-primary/10" />
              <div>
                <div className="flex gap-1 text-amber-500 mb-4">
                  {Array.from({ length: rev.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-500" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-foreground italic">&ldquo;{rev.comment}&rdquo;</p>
              </div>

              <div className="mt-6 pt-4 border-t flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm">{rev.name}</h4>
                  <p className="text-xs text-muted-foreground">{rev.role}</p>
                </div>
                <span className="text-[11px] font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                  {rev.event}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
