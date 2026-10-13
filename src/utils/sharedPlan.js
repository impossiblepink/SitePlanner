import { supabase } from '../lib/supabase';

export const SHARED_PLAN_ID = 'public';

export const fetchSharedPlan = async () => {
  if (!supabase) return { plan: null, updatedAt: null };
  const { data, error } = await supabase
    .from('shared_plans')
    .select('plan, owner_id, updated_at')
    .eq('id', SHARED_PLAN_ID)
    .maybeSingle();

  if (error) throw error;
  return {
    plan: data?.plan || null,
    ownerId: data?.owner_id || null,
    updatedAt: data?.updated_at || null,
  };
};

export const publishSharedPlan = async (plan, ownerId) => {
  if (!supabase) throw new Error('Shared storage is not configured.');
  const sharedPlan = {
    ...plan,
    id: 'shared-public',
    isDemo: false,
    isShared: true,
    updatedAt: Date.now(),
  };
  const { error } = await supabase.from('shared_plans').upsert({
    id: SHARED_PLAN_ID,
    owner_id: ownerId,
    plan: sharedPlan,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return sharedPlan;
};
