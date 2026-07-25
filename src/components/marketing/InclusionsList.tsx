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
        return <Speaker className="h-4 w-4 text-primary" />;
      case "mic":
        return <Mic className="h-4 w-4 text-primary" />;
      case "music":
        return <Music className="h-4 w-4 text-primary" />;
      case "sparkles":
        return <Sparkles className="h-4 w-4 text-amber-500" />;
      case "tablet":
        return <Tablet className="h-4 w-4 text-primary" />;
      case "monitor":
        return <Tv className="h-4 w-4 text-primary" />;
      case "wrench":
        return <Wrench className="h-4 w-4 text-primary" />;
      default:
        return <Cable className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <ul className="space-y-2.5">
      {inclusions.map((item) => (
        <li key={item.id} className="flex items-center gap-3 text-sm text-foreground">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary shrink-0">
            {getIcon(item.iconName)}
          </div>
          <span>
            <strong className="font-semibold text-primary">{item.quantity}x</strong> {item.name}
          </span>
        </li>
      ))}
    </ul>
  );
}
