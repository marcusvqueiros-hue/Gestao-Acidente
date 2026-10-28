import * as XLSX from "xlsx";
import { parseWorkbook } from "../src/lib/parse";

const src = process.argv[2] ?? "scripts/base.xlsx";
const ds = parseWorkbook(XLSX, XLSX.readFile(src));
await Bun.write("scripts/seed.json", JSON.stringify(ds));
const by = (k: (r: any) => string) => ds.registros.filter((r) => r.categoria === "acidente").reduce((m: any, r) => ((m[k(r)] = (m[k(r)] || 0) + 1), m), {});
console.log("acidentes", ds.registros.filter((r) => r.categoria === "acidente").length, "incidentes", ds.registros.filter((r) => r.categoria !== "acidente").length, "taxas", ds.taxas.length);
console.log(by((r) => r.data.slice(0, 4)), by((r) => r.lesao), by((r) => r.processo), by((r) => r.turno || "-"));
console.log(ds.registros.at(-1)?.hora, ds.registros.find((r) => r.hora)?.hora);
