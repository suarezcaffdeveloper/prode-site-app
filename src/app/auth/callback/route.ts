import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Recibe el redirect de Google OAuth con el ?code=..., lo intercambia por una
// sesión (PKCE) y deja las cookies puestas antes de mandar al usuario a su
// panel (según rol, salvo que venga un ?next= explícito).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      let destino = next;
      if (!destino) {
        const { data: usuario } = await supabase
          .from("usuarios")
          .select("rol")
          .eq("id", data.user.id)
          .single();
        destino = usuario?.rol === "admin" ? "/admin/ligas" : "/ligas";
      }
      return NextResponse.redirect(`${origin}${destino}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
