/*!
 * Supabase JavaScript Library (Versão Leve Personalizada)
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.supabase = {}));
})(this, (function (exports) { 'use strict';

    const createClient = (supabaseUrl, supabaseKey, options = {}) => {
        // Limpa a URL se vier com barra no final ou /rest/v1 duplicado
        const baseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
        
        const headers = {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
        };

        const buildUrl = (table, query = '') => `${baseUrl}/rest/v1/${table}${query}`;
        
        return {
            from: (table) => ({
                // 🔍 SELECT
                select: async (columns = '*') => {
                    try {
                        const res = await fetch(buildUrl(table), { method: 'GET', headers });
                        const data = await res.json();
                        return { data, error: res.ok ? null : data };
                    } catch (err) { return { data: null, error: err }; }
                },
                
                // ➕ INSERT
                insert: async (values) => {
                    try {
                        const res = await fetch(buildUrl(table), {
                            method: 'POST',
                            headers: { ...headers, 'Prefer': 'return=representation' },
                            body: JSON.stringify(values)
                        });
                        const data = await res.json();
                        return { data, error: res.ok ? null : data };
                    } catch (err) { return { data: null, error: err }; }
                },
                
                // ✏️ UPDATE (Corrigido para encadear com .eq)
                update: (values) => {
                    return {
                        eq: async (column, value) => {
                            try {
                                const res = await fetch(buildUrl(table, `?${column}=eq.${encodeURIComponent(value)}`), {
                                    method: 'PATCH',
                                    headers: { ...headers, 'Prefer': 'return=representation' },
                                    body: JSON.stringify(values)
                                });
                                const data = res.status !== 204 ? await res.json() : [];
                                return { data, error: res.ok ? null : data };
                            } catch (err) { return { data: null, error: err }; }
                        }
                    };
                },
                
                // 🗑️ DELETE (Corrigido para encadear com .eq)
                delete: () => {
                    return {
                        eq: async (column, value) => {
                            try {
                                const res = await fetch(buildUrl(table, `?${column}=eq.${encodeURIComponent(value)}`), {
                                    method: 'DELETE',
                                    headers
                                });
                                return { data: true, error: res.ok ? null : true };
                            } catch (err) { return { data: null, error: err }; }
                        }
                    };
                }
            }),
            
            // 🔄 ATUALIZAÇÃO AUTOMÁTICA EM TEMPO REAL (Polling 5s)
            channel: () => ({
                on: function() { return this; },
                subscribe: function() { 
                    setInterval(async () => {
                        if (typeof window.buscarVeiculos === 'function') { window.buscarVeiculos(); }
                    }, 5000);
                    return this; 
                }
            })
        };
    };

    exports.createClient = createClient;
    Object.defineProperty(exports, '__esModule', { value: true });
}));

// 🟢 CONFIGURAÇÃO E INICIALIZAÇÃO DA SUA CONTA SUPABASE
const SUPABASE_URL = 'https://bwrbduzlcbfbsrrnowam.supabase.co';
const SUPABASE_KEY = 'SUA_CHAVE_ANON_AQUI'; // Coloque sua chave anon do Supabase aqui se ainda não colocou!

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
