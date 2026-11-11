import { NextResponse } from 'next/server';
import { getAuthenticatedProfile } from '@/lib/auth/rbac';
import { recordAuditLog } from '@/lib/audit';

const VALID_CATEGORIES = ['credential', 'secure_note', 'recovery_key', 'document'] as const;

export async function GET() {
  const { supabase, profile } = await getAuthenticatedProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // RLS strictly restricts vault_items to owner_id = auth.uid()
  const { data, error } = await supabase
    .from('vault_items')
    .select('id, created_at, title, category, ciphertext, iv, salt, kdf_algorithm')
    .eq('owner_id', profile.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    category?: string;
    ciphertext?: string;
    iv?: string;
    salt?: string;
  } | null;

  if (!body?.title?.trim() || !body?.ciphertext || !body?.iv || !body?.salt) {
    return NextResponse.json(
      { error: 'Client-encrypted ciphertext, iv, salt, and title are required.' },
      { status: 400 }
    );
  }

  const category = VALID_CATEGORIES.includes(
    body.category as (typeof VALID_CATEGORIES)[number]
  )
    ? body.category
    : 'credential';

  const { data, error } = await supabase
    .from('vault_items')
    .insert({
      owner_id: profile.id,
      title: body.title.trim(),
      category,
      ciphertext: body.ciphertext,
      iv: body.iv,
      salt: body.salt,
    })
    .select('id, created_at, title, category, ciphertext, iv, salt, kdf_algorithm')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordAuditLog(supabase, profile, {
    module_slug: '05-vault-guardian',
    action: 'ENCRYPTED_VAULT_ITEM_STORED',
    resource_type: 'vault_items',
    resource_id: data.id,
    details: { category: data.category, zero_knowledge: true },
  });

  return NextResponse.json({ item: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { supabase, profile } = await getAuthenticatedProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Item id required.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('vault_items')
    .delete()
    .eq('id', id)
    .eq('owner_id', profile.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
