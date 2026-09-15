import { NextResponse } from "next/server";

export function GET(request: Request) {
  const target = new URL(request.url);
  target.port = "9001";
  target.pathname = "/admin";
  target.search = "";
  target.hash = "";
  return NextResponse.redirect(target);
}
