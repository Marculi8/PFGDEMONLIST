const SUPABASE_URL = 'https://qqvmrkmpkbemxzhoxjfa.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gy8sGfe7-_kjn2V4iH5RBA_Pto2Ruqk'; // 👈 cola a sb_publishable_... aqui

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Retorna o usuário logado atualmente, ou null se não estiver logado
 */
export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

/**
 * Retorna o perfil completo do usuário logado (com role, list_name, etc)
 */
export async function getCurrentProfile() {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) return null;
    return data;
}

/**
 * Verifica se o usuário logado tem um determinado cargo
 * Ex: hasRole('admin') ou hasRole('mod')
 */
export async function hasRole(...roles) {
    const profile = await getCurrentProfile();
    if (!profile) return false;
    return roles.includes(profile.role);
}
