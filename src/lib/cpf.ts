export const maskCPF = (s: string) => {
  const d = s.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

export const unmaskCPF = (s: string) => s.replace(/\D/g, "");

export const isValidCPF = (raw: string): boolean => {
  const cpf = unmaskCPF(raw);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (base: string, factor: number) => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) sum += parseInt(base[i]) * (factor - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(cpf.slice(0, 9), 10) === parseInt(cpf[9])
    && calc(cpf.slice(0, 10), 11) === parseInt(cpf[10]);
};

export const maskPhone = (s: string) => {
  const d = s.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d)/, "($1) $2-$3");
  return d.replace(/(\d{2})(\d{5})(\d)/, "($1) $2-$3");
};
