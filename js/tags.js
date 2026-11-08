// Categorias/tags disponíveis pras fases — vivem no Supabase (tabela
// tag_categories) pra dar pra criar categoria/tag nova sem precisar mexer
// no código. Usado tanto pra atribuir tags (Manage Levels → Edit Level)
// quanto pra exibir/filtrar na lista.

import { supabase } from './supabase.js';

export async function fetchTagGroups() {
    const { data, error } = await supabase
        .from('tag_categories')
        .select('*')
        .order('sort_order', { ascending: true });

    if (error || !data) return [];

    return data.map((row) => ({
        id: row.id,
        key: row.key,
        label: row.label,
        tags: row.tags || [],
    }));
}

export async function addTagCategory(label) {
    const key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!key) throw new Error('Please provide a valid category name.');

    const { data: existingRows } = await supabase.from('tag_categories').select('key, label, sort_order');
    const dup = (existingRows || []).find((r) => r.key === key || r.label.trim().toLowerCase() === label.trim().toLowerCase());
    if (dup) throw new Error(`"${dup.label}" already exists as a category.`);

    const nextOrder = (existingRows || []).reduce((max, r) => Math.max(max, r.sort_order || 0), 0) + 1;

    const { error } = await supabase.from('tag_categories').insert({
        key,
        label: label.trim(),
        tags: [],
        sort_order: nextOrder,
    });
    if (error) throw error;
}

export async function addTagToCategory(categoryId, tag) {
    const clean = tag.trim();
    if (!clean) throw new Error('Please provide a tag name.');

    const { data: category, error: fetchError } = await supabase
        .from('tag_categories')
        .select('tags')
        .eq('id', categoryId)
        .single();
    if (fetchError) throw fetchError;

    const currentTags = category.tags || [];
    if (currentTags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
        throw new Error(`"${clean}" already exists in this category.`);
    }

    const { error } = await supabase
        .from('tag_categories')
        .update({ tags: [...currentTags, clean] })
        .eq('id', categoryId);
    if (error) throw error;
}

