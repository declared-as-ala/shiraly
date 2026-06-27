import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getDiagnostics } from '@/lib/best-delivery';

/**
 * GET /api/admin/best-delivery/diagnostics
 * Shows the WSDL URL in use, the discovered target namespace, the list of SOAP
 * operations the live WSDL actually exposes, and whether GetOrder/GetRecette
 * exist. Never returns the password.
 */
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const diag = await getDiagnostics();
  return NextResponse.json(diag);
}
