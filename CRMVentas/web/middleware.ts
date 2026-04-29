import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Sin sesión → login
  if (!user && !pathname.startsWith('/login') && !pathname.startsWith('/api/auth')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Con sesión en login → dashboard
  if (user && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Proteger /catalogos — solo usuarios con clave 340 (Config CRM)
  if (user && pathname.startsWith('/catalogos')) {
    const { data } = await supabase
      .from('segModulosUsuarios')
      .select('clave')
      .eq('uid', user.id)
      .eq('clave', 340)
      .eq('acceso', true)
      .maybeSingle()

    if (!data) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
