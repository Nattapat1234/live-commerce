export function formatTHBFromCents(cents) {
const n = Number(cents || 0) / 100;
return n.toLocaleString("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 2 });
}
