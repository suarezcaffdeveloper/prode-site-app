"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/logo";

const ENLACES = [
  { href: "#como-funciona", etiqueta: "Cómo funciona" },
  { href: "#pozo", etiqueta: "El pozo" },
  { href: "#planes", etiqueta: "Planes" },
  { href: "#preguntas", etiqueta: "Preguntas" },
];

export function LandingNav() {
  const [scrolleado, setScrolleado] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    let pendiente = false;
    const actualizar = () => {
      pendiente = false;
      const y = window.scrollY;
      const alto = document.documentElement.scrollHeight - window.innerHeight;
      setScrolleado(y > 24);
      setProgreso(alto > 0 ? Math.min(100, (y / alto) * 100) : 0);
    };
    const alScroll = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(actualizar);
    };
    actualizar();
    window.addEventListener("scroll", alScroll, { passive: true });
    return () => window.removeEventListener("scroll", alScroll);
  }, []);

  const claro = scrolleado || menuAbierto;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        claro
          ? "border-b border-line bg-chalk-0/85 shadow-[0_8px_30px_rgba(16,36,26,0.08)] backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" aria-label="Prode, inicio" className="transition-transform hover:scale-105">
          <Logo inverted={!claro} />
        </Link>

        <nav aria-label="Secciones" className="hidden items-center gap-1 md:flex">
          {ENLACES.map((enlace) => (
            <a
              key={enlace.href}
              href={enlace.href}
              className={`group relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                claro ? "text-ink-600 hover:text-pitch-700" : "text-chalk-0/80 hover:text-chalk-0"
              }`}
            >
              {enlace.etiqueta}
              <span
                className="absolute inset-x-4 bottom-1 h-0.5 origin-left scale-x-0 rounded-full bg-lime-400 transition-transform duration-300 group-hover:scale-x-100"
                aria-hidden="true"
              />
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              claro ? "text-ink-900 hover:text-pitch-700" : "text-chalk-0 hover:text-lime-300"
            }`}
          >
            Ingresar
          </Link>
          <Link
            href="/registro"
            className="group relative overflow-hidden rounded-full bg-lime-400 px-5 py-2.5 text-sm font-semibold text-pitch-900 transition-all hover:-translate-y-0.5 hover:bg-lime-300 hover:shadow-[0_8px_24px_rgba(163,230,53,0.4)]"
          >
            <span className="relative z-10">Crear cuenta</span>
            <span
              className="absolute inset-y-0 left-0 w-1/3 animate-sheen bg-chalk-0/50 blur-sm"
              aria-hidden="true"
            />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMenuAbierto((abierto) => !abierto)}
          aria-expanded={menuAbierto}
          aria-controls="menu-movil"
          aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors md:hidden ${
            claro ? "text-ink-900 hover:bg-chalk-100" : "text-chalk-0 hover:bg-chalk-0/10"
          }`}
        >
          {menuAbierto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        id="menu-movil"
        className={`grid transition-[grid-template-rows,opacity] duration-300 md:hidden ${
          menuAbierto ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <nav aria-label="Secciones (móvil)" className="flex flex-col gap-1 px-6 pb-5">
            {ENLACES.map((enlace) => (
              <a
                key={enlace.href}
                href={enlace.href}
                onClick={() => setMenuAbierto(false)}
                tabIndex={menuAbierto ? 0 : -1}
                className="rounded-lg px-3 py-3 text-base font-medium text-ink-900 hover:bg-chalk-100"
              >
                {enlace.etiqueta}
              </a>
            ))}
            <div className="mt-2 flex gap-3">
              <Link
                href="/login"
                tabIndex={menuAbierto ? 0 : -1}
                className="flex-1 rounded-full border border-line-strong px-4 py-3 text-center text-sm font-semibold text-ink-900"
              >
                Ingresar
              </Link>
              <Link
                href="/registro"
                tabIndex={menuAbierto ? 0 : -1}
                className="flex-1 rounded-full bg-pitch-700 px-4 py-3 text-center text-sm font-semibold text-chalk-0"
              >
                Crear cuenta
              </Link>
            </div>
          </nav>
        </div>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 h-0.5 bg-transparent"
        aria-hidden="true"
      >
        <div
          className="h-full bg-lime-400 transition-[width] duration-150 ease-out"
          style={{ width: `${progreso}%` }}
        />
      </div>
    </header>
  );
}
