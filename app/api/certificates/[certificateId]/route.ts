import { NextResponse } from "next/server";
import { createCertificatePdf } from "@/lib/pdf/certificate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ certificateId: string }> }) {
  const { certificateId } = await params;
  const supabase = await createClient();
  const { data: certificate } = await supabase.from("course_certificates").select("id, tenant_id, recipient_name, verification_id, issuing_organization, issued_at, revoked, courses(title, cpd_hours_total)").eq("id", certificateId).maybeSingle();
  if (!certificate) return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  const course = Array.isArray(certificate.courses) ? certificate.courses[0] : certificate.courses;
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const pdf = createCertificatePdf({ recipientName: certificate.recipient_name, courseTitle: course.title, cpdHours: Number(course.cpd_hours_total), issuedDate: new Intl.DateTimeFormat("en-SG", { dateStyle: "long", timeZone: "Asia/Singapore" }).format(new Date(certificate.issued_at)), verificationId: certificate.verification_id, verificationUrl: `${siteUrl}/verify/${certificate.verification_id}` });
  const storagePath = `${certificate.tenant_id}/${certificate.id}.pdf`;
  const admin = createAdminClient();
  await admin.storage.from("course-certificates").upload(storagePath, pdf, { contentType: "application/pdf", upsert: true });
  await admin.from("course_certificates").update({ pdf_storage_path: storagePath }).eq("id", certificate.id);
  const filename = `${course.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "course"}-certificate.pdf`;
  return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" } });
}
