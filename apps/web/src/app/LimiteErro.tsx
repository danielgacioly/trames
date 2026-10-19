import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Se uma tela quebrar, mostra o erro no lugar dela em vez de deixar a página em branco.
 * `chave` muda a cada navegação, então trocar de tela limpa o erro.
 */
export class LimiteErro extends Component<{ children: ReactNode; chave?: string }, { erro: Error | null }> {
  state = { erro: null as Error | null };

  static getDerivedStateFromError(erro: Error) {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('Tela quebrou:', erro, info.componentStack);
  }

  componentDidUpdate(anterior: { chave?: string }) {
    if (this.state.erro && anterior.chave !== this.props.chave) this.setState({ erro: null });
  }

  render() {
    const { erro } = this.state;
    if (!erro) return this.props.children;
    return (
      <div className="cartao" role="alert" style={{ maxWidth: 640, margin: '48px auto', gap: 12 }}>
        <h1 className="titulo-2">Esta tela teve um problema</h1>
        <p className="texto-suave">Recarregue a página. Se continuar, envie a mensagem abaixo para quem cuida da Trames.</p>
        <pre style={{ margin: 0, padding: 12, borderRadius: 8, background: 'var(--areia-funda)', fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {erro.name}: {erro.message}
          {import.meta.env.DEV && erro.stack ? `\n\n${erro.stack.split('\n').slice(1, 6).join('\n')}` : ''}
        </pre>
        <button type="button" className="tr-btn tr-btn--primario" style={{ alignSelf: 'flex-start' }} onClick={() => location.reload()}>
          Recarregar
        </button>
      </div>
    );
  }
}
