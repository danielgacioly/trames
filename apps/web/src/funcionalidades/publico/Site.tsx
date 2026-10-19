import { Link } from 'react-router-dom';
import { useEu } from '../../dados/consultas';
import { Logo } from '../../ui/comuns';

/** Cabeçalho das páginas do site (planos, ajuda, termos...). A landing tem o seu, no HTML estático. */
export function CabecalhoSite({ atual }: { atual?: 'planos' | 'ajuda' }) {
  const sessao = useEu().data?.etapa === 'completa';
  const link = (ativo: boolean) => ({ color: ativo ? 'var(--mangue)' : 'var(--tinta)', textDecoration: 'none', fontWeight: ativo ? 500 : 400 });
  return (
    <header className="site-topo">
      <Logo altura={34} para="/" />
      <nav className="site-topo__nav" aria-label="Site">
        <a href="/#como-funciona" style={link(false)}>
          Como funciona
        </a>
        <Link to="/planos" style={link(atual === 'planos')} aria-current={atual === 'planos' ? 'page' : undefined}>
          Planos
        </Link>
        <Link to="/ajuda" style={link(atual === 'ajuda')} aria-current={atual === 'ajuda' ? 'page' : undefined}>
          Ajuda
        </Link>
      </nav>
      <div className="linha">
        {sessao ? (
          <Link to="/app" className="tr-btn tr-btn--primario">
            Voltar para a conta
          </Link>
        ) : (
          <>
            <Link to="/entrar" className="tr-btn tr-btn--discreto">
              Entrar
            </Link>
            <Link to="/criar-conta" className="tr-btn tr-btn--primario">
              Criar conta grátis
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

const COLUNAS: { titulo: string; links: [string, string][] }[] = [
  { titulo: 'Produto', links: [['Como funciona', '/#como-funciona'], ['Planos', '/planos'], ['Segurança', '/#seguranca']] },
  { titulo: 'Suporte', links: [['Central de ajuda', '/ajuda'], ['Contato', '/contato']] },
  { titulo: 'Legal', links: [['Termos de uso', '/termos'], ['Privacidade', '/privacidade']] },
];

export function RodapeSite() {
  return (
    <footer className="site-rodape">
      <div className="coluna" style={{ gap: 12, maxWidth: 280 }}>
        <Logo altura={26} />
        <span className="pequeno texto-suave">Documentos dos seus clientes, organizados num balcão só. Feito no Recife.</span>
      </div>
      <div className="site-rodape__colunas">
        {COLUNAS.map((c) => (
          <nav key={c.titulo} aria-label={c.titulo} className="coluna" style={{ gap: 10 }}>
            <span className="miudo" style={{ fontWeight: 600, color: 'var(--tinta)' }}>
              {c.titulo}
            </span>
            {c.links.map(([rotulo, para]) =>
              para.startsWith('/#') ? (
                <a key={para} href={para} className="pequeno texto-suave">
                  {rotulo}
                </a>
              ) : (
                <Link key={para} to={para} className="pequeno texto-suave">
                  {rotulo}
                </Link>
              ),
            )}
          </nav>
        ))}
      </div>
      <span className="miudo texto-suave site-rodape__fim">© {new Date().getFullYear()} Trames</span>
    </footer>
  );
}
