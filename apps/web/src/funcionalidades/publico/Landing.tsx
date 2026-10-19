import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import htmlLanding from '../../landing/landing.html?raw';
import '../../landing/landing.css';

/** Links internos da landing (HTML estático do protótipo) passam pelo roteador. */
function useLinksInternos() {
  const navegar = useNavigate();
  return (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest('a');
    const href = a?.getAttribute('href');
    if (!href || !href.startsWith('/') || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    navegar(href);
    window.scrollTo(0, 0);
  };
}

export function Landing() {
  const aoClicar = useLinksInternos();
  return <div onClick={aoClicar} dangerouslySetInnerHTML={{ __html: htmlLanding }} />;
}
