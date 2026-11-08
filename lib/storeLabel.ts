/** Big text on a store card: "$40 bonus buy" → "$40", "Keno: $1 x15" → "Keno" (a "Name:" prefix wins). */
export function headline(name: string): string {
  if (name.includes(":")) return name.split(":")[0].trim();
  return name.match(/\$\d[\d,]*/)?.[0] ?? name.split(/[·-]/)[0].trim().split(" ").slice(0, 2).join(" ");
}
