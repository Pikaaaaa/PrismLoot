import { Button } from "@/components/ui/Button";
import { Compass, Home } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="surface surface-pad mx-auto w-full max-w-md text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-line bg-graphite">
          <Compass className="h-5 w-5 text-mute" />
        </div>
        <p className="label">Error 404</p>
        <h1 className="mt-1">Off the map</h1>
        <p className="mt-2 text-sm text-mute">This route is not part of PrismLoot.</p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Link href="/">
            <Button icon={<Home className="h-4 w-4" />}>Return home</Button>
          </Link>
          <Link href="/cases">
            <Button variant="ghost">Browse cases</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
