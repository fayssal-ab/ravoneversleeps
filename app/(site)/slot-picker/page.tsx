import type { Metadata } from "next";
import Link from "next/link";
import { SlotPickerReel } from "@/components/slotpicker/SlotPickerReel";
import { EmptyState, PageHeader } from "@/components/ui/bits";
import { popularSlots } from "@/lib/slots";

export const metadata: Metadata = { title: "Slot picker", description: "Can't decide what to play? Spin the reel and let it pick a random slot from the most played." };
export const revalidate = 3600;

/** How many of the most played slots (with art) the reel draws from. */
const POOL = 300;

export default async function SlotPickerPage() {
  const slots = await popularSlots(POOL);
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader eyebrow="Can't decide?" title="Slot" accent="picker">
        Spin the reel and it picks a random slot from the {slots.length || POOL} most played.
      </PageHeader>
      {slots.length < 2 ? (
        <EmptyState title="Picker offline" action={<Link href="/" className="btn btn-neon">Back home</Link>}>
          The slot list isn&apos;t available right now. Try again in a minute.
        </EmptyState>
      ) : (
        <SlotPickerReel slots={slots.map((s) => ({ id: s.id, name: s.name, provider: s.provider, image: s.imageUrl ?? "" }))} />
      )}
    </div>
  );
}
