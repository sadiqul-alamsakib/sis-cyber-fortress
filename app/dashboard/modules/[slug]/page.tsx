import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { requireDashboardSession } from '@/lib/auth/session-guard';
import { getModuleBySlug } from '@/lib/modules/catalog';
import DashboardShell from '@/components/dashboard/DashboardShell';
import ModuleWorkspace from '@/components/modules/ModuleWorkspace';

async function ModuleDetailContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mod = getModuleBySlug(slug);
  if (!mod) {
    notFound();
  }

  const { profile } = await requireDashboardSession();

  return (
    <DashboardShell
      profile={profile}
      title={`${mod.code}. ${mod.name}`}
      subtitle={mod.summary}
    >
      <ModuleWorkspace mod={mod} profile={profile} />
    </DashboardShell>
  );
}

export default function ModuleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07080b]" />}>
      <ModuleDetailContent params={params} />
    </Suspense>
  );
}
