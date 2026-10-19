const CAMINHOS = {
  mais: 'M12 5v14M5 12h14',
  voltar: 'M15 6l-6 6 6 6',
  seta: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  xis: 'M7 7l10 10M17 7L7 17',
  lupa: 'M11 4.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13zM16 16l4 4',
  relogio: 'M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 0 1 0-17zM12 7.5V12l3 2',
  calendario: 'M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4 10h16M9 3v4M15 3v4',
  balcoes: 'M4 20V11a8 8 0 0 1 16 0v9M9 20v-6a3 3 0 0 1 6 0v6',
  modelos: 'M5.5 4h4A1.5 1.5 0 0 1 11 5.5v4A1.5 1.5 0 0 1 9.5 11h-4A1.5 1.5 0 0 1 4 9.5v-4A1.5 1.5 0 0 1 5.5 4zM14.5 4h4A1.5 1.5 0 0 1 20 5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 13 9.5v-4A1.5 1.5 0 0 1 14.5 4zM5.5 13h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 9.5 20h-4A1.5 1.5 0 0 1 4 18.5v-4A1.5 1.5 0 0 1 5.5 13zM14.5 13h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5z',
  clientes: 'M9 4.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 0 1 0-7zM3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M21 20a6 6 0 0 0-4-5.6',
  turu: 'M4 18V9a8 8 0 0 1 16 0v9M9 18v-5a3 3 0 0 1 6 0v5',
  equipe: 'M8 7a3 3 0 1 1 0 6a3 3 0 0 1 0-6zM16 7a3 3 0 1 1 0 6a3 3 0 0 1 0-6zM2.5 20a5.5 5.5 0 0 1 11 0M10.5 20a5.5 5.5 0 0 1 11 0',
  relatorio: 'M5 20V10M10 20V4M15 20v-7M20 20V8',
  ajustes: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  cadeado: 'M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3',
  copiar: 'M10 8h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2',
  envio: 'M12 15V4M7.5 8.5L12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3',
  camera: 'M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.6-2h5.4l1.6 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM12 9a3.5 3.5 0 1 1 0 7a3.5 3.5 0 0 1 0-7z',
  info: 'M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 0 1 0-17zM12 11v5M12 8v.1',
  sino: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  sair: 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10',
  lixo: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12',
  cima: 'M6 15l6-6 6 6',
  baixo: 'M6 9l6 6 6-6',
  alca: 'M9 6v.1M15 6v.1M9 12v.1M15 12v.1M9 18v.1M15 18v.1',
  baixar: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3',
  menu: 'M4 7h16M4 12h16M4 17h16',
  pasta: 'M3.5 7A1.5 1.5 0 0 1 5 5.5h4.2l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5v8.3A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z',
  avancar: 'M9 6l6 6-6 6',
  inicio: 'M4 11l8-6.5 8 6.5M6 9.5V19h12V9.5',
} as const;

export type NomeIcone = keyof typeof CAMINHOS;

export function Icone({ nome, tamanho, className = 'tr-icone' }: { nome: NomeIcone; tamanho?: number; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" style={tamanho ? { width: tamanho, height: tamanho } : undefined}>
      <path d={CAMINHOS[nome]} />
    </svg>
  );
}
