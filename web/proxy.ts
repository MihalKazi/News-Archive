import { NextRequest, NextResponse } from "next/server";

// Demo gate: basic auth on every route. Fails closed if env unset.
// Set DEMO_USER and DEMO_PASSWORD in the deploy environment.

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function decodeBasic(header: string): [string, string] | null {
  try {
    const decoded = atob(header.slice("Basic ".length));
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    return [decoded.slice(0, idx), decoded.slice(idx + 1)];
  } catch {
    return null;
  }
}

export function proxy(req: NextRequest) {
  const user = process.env.DEMO_USER;
  const pass = process.env.DEMO_PASSWORD;
  if (!user || !pass) {
    return new NextResponse("Demo gate not configured", { status: 503 });
  }

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const creds = decodeBasic(header);
    if (creds && creds[0] === user && creds[1] === pass) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="News Archive", charset="UTF-8"' },
  });
}
