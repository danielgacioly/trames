import { useSyncExternalStore } from 'react';
import { PLANOS, type Plano, type Recurso } from './planos';
import { criarDbInicial, gerarCodigo } from './seed';
import type { AreaId, Balcao, Cliente, Conta, Db, ItemModelo, Modelo, Permissao, PlanoId, Usuario } from './tipos';

/**
 * Estado do protótipo: tudo fica no localStorage do navegador.
 * O balcão do cliente (/b/...) lê o mesmo estado, então dá para testar
 * os dois lados no mesmo navegador.
 */
const CHAVE = 'trames:db';
const VERSAO = 1;

function carregar(): Db {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) {
      const db = JSON.parse(bruto) as Db;
      if (db.versao === VERSAO) return db;
    }
  } catch {
    // sem localStorage ou dado corrompido: recomeça
  }
  return criarDbInicial();
}

let estado: Db = carregar();
const ouvintes = new Set<() => void>();

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    // modo privado: segue só em memória
  }
}

function atualizar(fn: (db: Db) => Db) {
  estado = fn(estado);
  salvar();
  ouvintes.forEach((o) => o());
}

function inscrever(o: () => void) {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}

export function useDb() {
  return useSyncExternalStore(inscrever, () => estado);
}

// Outra aba (ex.: a visão do cliente) mudou o estado.
window.addEventListener('storage', (e) => {
  if (e.key === CHAVE) {
    estado = carregar();
    ouvintes.forEach((o) => o());
  }
});

// ---------- Leituras ----------

export interface Sessao {
  usuario: Usuario;
  conta: Conta;
  plano: Plano;
}

export function sessaoDe(db: Db): Sessao | null {
  const usuario = db.usuarios.find((u) => u.id === db.sessao);
  const conta = usuario && db.contas.find((c) => c.id === usuario.contaId);
  if (!usuario || !conta) return null;
  return { usuario, conta, plano: PLANOS[conta.plano] };
}

export function useSessao() {
  return sessaoDe(useDb());
}

export function tem(sessao: Sessao, recurso: Recurso) {
  return sessao.plano.recursos[recurso];
}

export const estaAberto = (b: Balcao) => !b.concluidoEm;

export function balcoesDaConta(db: Db, contaId: string) {
  return db.balcoes.filter((b) => b.contaId === contaId);
}

export function balcoesAtivos(db: Db, contaId: string) {
  return balcoesDaConta(db, contaId).filter(estaAberto);
}

export function podeAbrirBalcao(db: Db, sessao: Sessao) {
  const limite = sessao.plano.limiteBalcoes;
  return limite === null || balcoesAtivos(db, sessao.conta.id).length < limite;
}

export function pessoasDaConta(db: Db, contaId: string) {
  return db.usuarios.filter((u) => u.contaId === contaId);
}

export function modelosDaConta(db: Db, contaId: string) {
  return db.modelos.filter((m) => m.contaId === contaId);
}

export function modelosPadrao(db: Db, area?: AreaId) {
  return db.modelos.filter((m) => !m.contaId && (!area || m.area === area));
}

export function contagem(b: Balcao) {
  const c = { aprovado: 0, analise: 0, pendente: 0, recusado: 0 };
  b.docs.forEach((d) => c[d.status]++);
  return { ...c, total: b.docs.length };
}

export function podeConcluir(b: Balcao) {
  return b.docs.every((d) => !d.obrigatorio || d.status === 'aprovado');
}

// ---------- Ações ----------

function proximo(prefixo: string) {
  let n = 0;
  atualizar((db) => {
    n = db.seq + 1;
    return { ...db, seq: n };
  });
  return { id: `${prefixo}${n}`, n };
}

function mudarBalcao(id: string, fn: (b: Balcao) => Balcao) {
  atualizar((db) => ({ ...db, balcoes: db.balcoes.map((b) => (b.id === id ? fn(b) : b)) }));
}

export const acoes = {
  entrar(email: string, senha: string) {
    const u = estado.usuarios.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.senha !== senha) return false;
    atualizar((db) => ({ ...db, sessao: u.id }));
    return true;
  },

  sair() {
    atualizar((db) => ({ ...db, sessao: null }));
  },

  restaurar() {
    estado = criarDbInicial();
    salvar();
    ouvintes.forEach((o) => o());
  },

  criarConta(dados: { nome: string; escritorio: string; email: string; senha: string }) {
    if (estado.usuarios.some((u) => u.email.toLowerCase() === dados.email.trim().toLowerCase())) {
      return 'Já existe uma conta com este e-mail.';
    }
    const { id: contaId } = proximo('c-');
    const { id: usuarioId } = proximo('u-');
    const sigla = dados.escritorio
      .split(/\s+/)
      .filter((p) => p.length > 2 || /^[A-Z]/.test(p))
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    atualizar((db) => ({
      ...db,
      contas: [...db.contas, { id: contaId, nome: dados.escritorio.trim(), sigla: sigla || 'TR', cor: '#13594b', area: 'advocacia', plano: 'gratis' }],
      usuarios: [...db.usuarios, { id: usuarioId, contaId, nome: dados.nome.trim(), email: dados.email.trim(), senha: dados.senha, permissao: 'admin' }],
      sessao: usuarioId,
    }));
    return null;
  },

  definirArea(contaId: string, area: AreaId) {
    atualizar((db) => ({ ...db, contas: db.contas.map((c) => (c.id === contaId ? { ...c, area } : c)) }));
  },

  mudarPlano(contaId: string, plano: PlanoId) {
    atualizar((db) => ({ ...db, contas: db.contas.map((c) => (c.id === contaId ? { ...c, plano } : c)) }));
  },

  atualizarConta(contaId: string, dados: Partial<Pick<Conta, 'nome' | 'sigla' | 'cor'>>) {
    atualizar((db) => ({ ...db, contas: db.contas.map((c) => (c.id === contaId ? { ...c, ...dados } : c)) }));
  },

  criarBalcao(dados: { contaId: string; tipo: string; cliente: Cliente; prazo: string; lembrete: boolean; itens: ItemModelo[] }) {
    const { id, n } = proximo('b');
    const b: Balcao = {
      id,
      contaId: dados.contaId,
      codigo: gerarCodigo(n),
      protocolo: `TRM-2026-${String(n).padStart(5, '0')}`,
      tipo: dados.tipo,
      cliente: dados.cliente,
      prazo: dados.prazo,
      lembrete: dados.lembrete,
      criadoEm: new Date().toISOString(),
      docs: dados.itens.map((it, k) => ({ id: `d${k + 1}`, ...it, status: 'pendente' })),
    };
    atualizar((db) => ({ ...db, balcoes: [b, ...db.balcoes] }));
    return b;
  },

  aprovar(balcaoId: string, docId: string) {
    mudarBalcao(balcaoId, (b) => ({ ...b, docs: b.docs.map((d) => (d.id === docId ? { ...d, status: 'aprovado', motivo: undefined } : d)) }));
  },

  recusar(balcaoId: string, docId: string, motivo: string) {
    mudarBalcao(balcaoId, (b) => ({ ...b, docs: b.docs.map((d) => (d.id === docId ? { ...d, status: 'recusado', motivo } : d)) }));
  },

  enviarDocumento(balcaoId: string, docId: string, arquivo: string) {
    mudarBalcao(balcaoId, (b) => ({
      ...b,
      docs: b.docs.map((d) => (d.id === docId ? { ...d, status: 'analise', arquivo, enviadoEm: new Date().toISOString(), motivo: undefined } : d)),
    }));
  },

  concluirBalcao(balcaoId: string) {
    mudarBalcao(balcaoId, (b) => ({ ...b, concluidoEm: new Date().toISOString() }));
  },

  reabrirBalcao(balcaoId: string) {
    mudarBalcao(balcaoId, (b) => ({ ...b, concluidoEm: undefined }));
  },

  salvarModelo(m: Omit<Modelo, 'id'> & { id?: string }) {
    const id = m.id ?? proximo('m-').id;
    const modelo = { ...m, id } as Modelo;
    atualizar((db) => ({
      ...db,
      modelos: db.modelos.some((x) => x.id === id) ? db.modelos.map((x) => (x.id === id ? modelo : x)) : [...db.modelos, modelo],
    }));
    return modelo;
  },

  excluirModelo(id: string) {
    atualizar((db) => ({ ...db, modelos: db.modelos.filter((m) => m.id !== id) }));
  },

  convidar(contaId: string, nome: string, email: string, permissao: Permissao) {
    const { id } = proximo('u-');
    atualizar((db) => ({ ...db, usuarios: [...db.usuarios, { id, contaId, nome: nome.trim(), email: email.trim(), senha: 'trames123', permissao }] }));
  },

  mudarPermissao(usuarioId: string, permissao: Permissao) {
    atualizar((db) => ({ ...db, usuarios: db.usuarios.map((u) => (u.id === usuarioId ? { ...u, permissao } : u)) }));
  },

  removerPessoa(usuarioId: string) {
    atualizar((db) => ({ ...db, usuarios: db.usuarios.filter((u) => u.id !== usuarioId) }));
  },
};
