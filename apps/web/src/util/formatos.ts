const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function paraData(valor: string) {
  // "AAAA-MM-DD" vira meia-noite local, não UTC
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T00:00:00`) : new Date(valor);
}

export function dataLonga(valor: string, comAno = false) {
  const d = paraData(valor);
  return `${d.getDate()} de ${MESES[d.getMonth()]}${comAno ? ` de ${d.getFullYear()}` : ''}`;
}

export function diasAte(valor: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((paraData(valor).getTime() - hoje.getTime()) / 86400000);
}

/** "nesta quarta", "amanhã", "7 de novembro"… */
export function prazoRelativo(valor: string) {
  const n = diasAte(valor);
  if (n < 0) return n === -1 ? 'ontem' : `há ${-n} dias`;
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n < 7) return `nesta ${SEMANA[paraData(valor).getDay()]}`.replace('nesta sábado', 'neste sábado').replace('nesta domingo', 'neste domingo');
  return `em ${dataLonga(valor)}`;
}

export function quandoEnviado(valor: string) {
  const d = new Date(valor);
  const doisDigitos = (x: number) => String(x).padStart(2, '0');
  const n = -diasAte(`${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`);
  const hora = `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
  if (n === 0) return `Enviado hoje às ${hora}`;
  if (n === 1) return `Enviado ontem às ${hora}`;
  return `Enviado em ${dataLonga(valor)}`;
}

export function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export const primeiroNome = (nome: string) => nome.split(' ')[0];

export function iniciais(nome: string) {
  const partes = nome.split(/\s+/).filter((p) => p.length > 2);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? partes[0]?.[1] ?? '')).toUpperCase();
}

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export const pct = (parte: number, total: number) => (total ? Math.round((parte / total) * 100) : 0);

export function soDigitos(s: string) {
  return s.replace(/\D/g, '');
}

/** Data (AAAA-MM-DD) a n dias de hoje, no fuso local. */
export function diaDaqui(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function tamanhoLegivel(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const moeda = (centavos: number) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Data e hora curtas: "12 de março, 14:05". */
export function dataHora(valor: string) {
  const d = new Date(valor);
  return `${dataLonga(valor)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
