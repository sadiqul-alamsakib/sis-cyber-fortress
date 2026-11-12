-- ============================================================================
-- SIS Cyber Fortress — Complete 12-in-1 Enterprise Schema, RBAC & Realtime
-- Live Supabase Project: fgblxhexydgwpltmxros (sis-cyber-fortress)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM (
      'super_admin',
      'security_admin',
      'module_admin',
      'auditor',
      'admin',
      'analyst',
      'viewer'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'threat_status') THEN
    CREATE TYPE public.threat_status AS ENUM ('Critical', 'Warning', 'Secure');
  END IF;
END
$$;

-- 1. User Profiles & Role-Based Access Control (RBAC)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role public.user_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    'viewer'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url);

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC, anon;

-- 2. Real-Time Security Logs
CREATE TABLE IF NOT EXISTS public.security_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_ip TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  target_node TEXT NOT NULL,
  status public.threat_status NOT NULL DEFAULT 'Warning',
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON public.security_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_status_unresolved ON public.security_logs (status, is_resolved) WHERE is_resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_security_logs_resolved_by ON public.security_logs (resolved_by);

-- 3. Authorized Assets Registry (Modules 03, 04, 07)
CREATE TABLE IF NOT EXISTS public.authorized_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('website', 'android_device', 'server_node', 'network_ap')),
  identifier TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'staging', 'lab')),
  is_authorized BOOLEAN NOT NULL DEFAULT TRUE,
  compliance_status TEXT NOT NULL DEFAULT 'compliant' CHECK (compliance_status IN ('compliant', 'warning', 'non_compliant')),
  os_or_stack TEXT,
  last_scanned_at TIMESTAMPTZ,
  registered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 4. Login Activities (Modules 01 & 09)
CREATE TABLE IF NOT EXISTS public.login_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google',
  ip_address TEXT NOT NULL DEFAULT 'unknown',
  user_agent TEXT,
  mfa_verified BOOLEAN NOT NULL DEFAULT FALSE,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  is_suspicious BOOLEAN NOT NULL DEFAULT FALSE
);

-- 5. Phishing Scans (Module 02)
CREATE TABLE IF NOT EXISTS public.phishing_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_url TEXT NOT NULL,
  hostname TEXT NOT NULL,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  verdict TEXT NOT NULL CHECK (verdict IN ('safe', 'suspicious', 'malicious')),
  findings JSONB NOT NULL DEFAULT '[]'::jsonb,
  dns_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  is_reported_threat BOOLEAN NOT NULL DEFAULT FALSE
);

-- 6. Network Sentinel Assessments (Module 04)
CREATE TABLE IF NOT EXISTS public.network_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  asset_id UUID REFERENCES public.authorized_assets(id) ON DELETE SET NULL,
  assessed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  network_name TEXT NOT NULL,
  encryption_type TEXT NOT NULL CHECK (encryption_type IN ('WPA3', 'WPA2', 'WEP', 'OPEN', 'LAN_TLS')),
  dns_sec_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  vpn_active BOOLEAN NOT NULL DEFAULT TRUE,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  checklist_score INTEGER NOT NULL CHECK (checklist_score >= 0 AND checklist_score <= 100),
  notes TEXT
);

-- 7. Zero-Knowledge Vault Items (Module 05 — Ciphertext Only)
CREATE TABLE IF NOT EXISTS public.vault_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'credential' CHECK (category IN ('credential', 'secure_note', 'recovery_key', 'document')),
  ciphertext TEXT NOT NULL,
  iv TEXT NOT NULL,
  salt TEXT NOT NULL,
  kdf_algorithm TEXT NOT NULL DEFAULT 'PBKDF2-SHA256-AES256GCM'
);

-- 8. Ransomware & Cloud Backup Policies (Modules 06 & 11)
CREATE TABLE IF NOT EXISTS public.backup_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  asset_id UUID REFERENCES public.authorized_assets(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  policy_name TEXT NOT NULL,
  schedule_cron TEXT NOT NULL DEFAULT '0 2 * * *',
  retention_days INTEGER NOT NULL DEFAULT 30,
  encryption_standard TEXT NOT NULL DEFAULT 'AES-256-GCM',
  storage_used_mb NUMERIC(10, 2) NOT NULL DEFAULT 0,
  integrity_verified BOOLEAN NOT NULL DEFAULT TRUE,
  last_backup_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'warning', 'failed', 'restoring'))
);

-- 9. WebShield Authorized Scans (Module 07)
CREATE TABLE IF NOT EXISTS public.webshield_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  asset_id UUID NOT NULL REFERENCES public.authorized_assets(id) ON DELETE CASCADE,
  scanned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_url TEXT NOT NULL,
  http_status INTEGER,
  tls_valid BOOLEAN NOT NULL DEFAULT FALSE,
  tls_expires_at TIMESTAMPTZ,
  tls_issuer TEXT,
  security_score INTEGER NOT NULL CHECK (security_score >= 0 AND security_score <= 100),
  headers_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  dns_records JSONB NOT NULL DEFAULT '{}'::jsonb,
  remediations JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 10. Digital Forensics Cases & Evidence (Module 08)
CREATE TABLE IF NOT EXISTS public.forensics_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  case_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'analyzing', 'preserved', 'closed')),
  lead_investigator UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  summary TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.forensics_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  case_id UUID NOT NULL REFERENCES public.forensics_cases(id) ON DELETE CASCADE,
  collected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  evidence_label TEXT NOT NULL,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('log_bundle', 'memory_hash', 'network_pcap', 'disk_image_meta', 'email_header')),
  sha256_checksum TEXT NOT NULL,
  custody_note TEXT NOT NULL
);

-- 11. Threat Intelligence IOCs (Module 10)
CREATE TABLE IF NOT EXISTS public.threat_iocs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ioc_type TEXT NOT NULL CHECK (ioc_type IN ('domain', 'url', 'ip', 'hash')),
  indicator TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  source_feed TEXT NOT NULL DEFAULT 'SIS-Internal-SOC',
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 12. Cyber SOC Incidents (Module 12)
CREATE TABLE IF NOT EXISTS public.soc_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title TEXT NOT NULL,
  module_source TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'contained', 'resolved')),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  description TEXT NOT NULL
);

-- 13. Central Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  module_slug TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 14. Interconnected Control Plane: Device Commands & Shared Security Policies
CREATE TABLE IF NOT EXISTS public.device_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  asset_id UUID NOT NULL REFERENCES public.authorized_assets(id) ON DELETE CASCADE,
  target_platform TEXT NOT NULL CHECK (target_platform IN ('android', 'web')),
  command_type TEXT NOT NULL CHECK (
    command_type IN (
      'SYNC_TELEMETRY',
      'LOCK_VAULT',
      'REVOKE_SESSION',
      'PUSH_SECURITY_ALERT',
      'RUN_NETWORK_CHECK',
      'RUN_BACKUP_DRILL',
      'RUN_WEBSHIELD_SCAN'
    )
  ),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'executed', 'failed')),
  issued_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  executed_at TIMESTAMPTZ,
  result_message TEXT
);

CREATE TABLE IF NOT EXISTS public.security_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  policy_key TEXT NOT NULL UNIQUE,
  policy_name TEXT NOT NULL,
  description TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'android', 'web')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.authorized_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phishing_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webshield_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forensics_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forensics_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threat_iocs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soc_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_policies ENABLE ROW LEVEL SECURITY;

-- Enable Supabase Realtime on security_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'security_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.security_logs;
  END IF;
END
$$;
