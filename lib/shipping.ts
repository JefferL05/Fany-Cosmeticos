export type CepAddress = { uf: string; city: string; street: string };

// ViaCEP is a free, keyless public lookup; it only resolves the postal code to
// an address, it never prices freight. Freight itself is priced server-side
// from public.shipping_zones so the browser cannot forge a discount.
export async function lookupCep(cep: string, signal?: AbortSignal): Promise<CepAddress | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: signal ?? AbortSignal.timeout(10000) });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.erro || !/^[A-Z]{2}$/.test(data.uf) || typeof data.localidade !== "string") return null;
    return { uf: data.uf, city: data.localidade, street: data.logradouro };
  } catch {
    return null;
  }
}
