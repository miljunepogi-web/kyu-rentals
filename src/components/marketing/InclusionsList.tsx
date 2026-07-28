import { PackageInclusion } from "@/queries/packages.queries";
import { Speaker, Mic, Music, Tablet, Cable, Sparkles, Wrench, Tv } from "lucide-react";

interface InclusionsListProps {
  inclusions: PackageInclusion[];
}

export function InclusionsList({ inclusions }: InclusionsListProps) {
  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case "speaker":
      case "subwoofer":
        return <Speaker className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />;
      case "mic":
        return <Mic className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />;
      case "music":
        return <Music className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />;
      case "sparkles":
        return <Sparkles className="h-4 w-4 text-amber-500 shrink-0" aria-hidden="true" />;
      case "tablet":
        return <Tablet className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />;
      case "monitor":
        return <Tv className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />;
      case "wrench":
        return <Wrench className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />;
      default:
        return <Cable className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />;
    }
  };

  return (
    <ul className="space-y-2.5" aria-label="Package inclusions">
      {inclusions.map((item) => (
        <li key={item.id} className="flex items-center gap-3 text-xs sm:text-sm text-foreground">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary shrink-0" aria-hidden="true">
            {getIcon(item.iconName)}
          </div>
          <span className="leading-snug">
            <strong className="font-bold text-primary">{item.quantity}x</strong> {item.name}
          </span>
        </li>
      ))}
    </ul>
  );
}
